import { after, NextResponse } from "next/server";
import { today } from "@/lib/public-jobs";
import { readSession } from "@/lib/applicant/session";
import { getI18n } from "@/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { parseResume } from "@/lib/ai/resume";
import { createAdminClient } from "@/lib/supabase/admin";

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

// Vérifie le contenu réel du fichier, pas seulement son nom.
function hasValidSignature(ext: string, head: Uint8Array) {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (ext === "pdf") return starts(0x25, 0x50, 0x44, 0x46); // %PDF
  if (ext === "docx") return starts(0x50, 0x4b); // PK (zip)
  return starts(0xd0, 0xcf, 0x11, 0xe0); // doc (OLE)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { t } = await getI18n();
  const { jobId } = await params;
  if (!(await rateLimit("apply-cv", 20, 3600))) return fail(t("common.tooMany"), 429);
  const session = await readSession(jobId);
  if (!session) return fail(t("apply.errors.sessionExpired"), 401);

  const form = await req.formData().catch(() => null);
  const questionId = String(form?.get("questionId") ?? "");
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(t("apply.errors.missingFile"), 400);

  const db = createAdminClient();
  const [{ data: job }, { data: q }, { data: app }] = await Promise.all([
    db.from("job_forms").select("cv_max_mb, companies!inner(is_active)").eq("id", jobId).eq("is_active", true).eq("companies.is_active", true).or(`deadline.is.null,deadline.gte.${today()}`).single(),
    db.from("questions").select("id, type, page_number, job_form_id").eq("id", questionId).single(),
    db
      .from("applications")
      .select("id, status")
      .eq("id", session.applicationId)
      .eq("job_form_id", jobId)
      .single(),
  ]);
  if (!job || !app || app.status !== "incomplete") return fail(t("apply.errors.closed"), 403);
  if (!q || q.job_form_id !== jobId || q.type !== "file_upload" || q.page_number !== session.page) {
    return fail(t("apply.errors.invalidQuestion"), 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const okMime = !file.type || file.type === "application/octet-stream" || MIME[ext]?.includes(file.type);
  if (!MIME[ext] || !okMime) return fail(t("apply.cv.badType"), 400);
  if (file.size === 0) return fail(t("apply.errors.fileEmpty"), 400);
  if (file.size > job.cv_max_mb * 1024 * 1024) {
    return fail(t("apply.cv.tooLarge", { mb: job.cv_max_mb }), 413);
  }
  if (!hasValidSignature(ext, new Uint8Array(await file.slice(0, 8).arrayBuffer()))) {
    return fail(t("apply.errors.cvBadSignature"), 400);
  }

  // Un CV déjà envoyé est remplacé.
  const { data: old } = await db
    .from("resumes")
    .select("file_url")
    .eq("application_id", app.id)
    .maybeSingle();

  const path = `${app.id}/cv.${ext}`;
  const { error: upErr } = await db.storage
    .from("resumes")
    .upload(path, file, { contentType: file.type || MIME[ext][0], upsert: true });
  if (upErr) return fail(t("apply.errors.cannotUploadFile"), 500);
  if (old && old.file_url !== path) await db.storage.from("resumes").remove([old.file_url]);

  const { error } = await db
    .from("resumes")
    .upsert(
      { application_id: app.id, file_url: path, parsed_data: null, parse_status: "pending" },
      { onConflict: "application_id" }
    );
  if (error) return fail(t("apply.errors.cannotSaveFile"), 500);

  after(() => parseResume(app.id));
  return NextResponse.json({ ok: true });
}
