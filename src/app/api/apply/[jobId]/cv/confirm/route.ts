import { after, NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { parseResume } from "@/lib/ai/resume";
import { CV_MIME, cvContext, hasValidSignature } from "@/lib/apply-cv";
import { rateLimit } from "@/lib/rate-limit";

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Étape 2 : le fichier est déjà dans le stockage. On contrôle sa taille et son contenu réel, puis on l'enregistre.
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { t } = await getI18n();
  const { jobId } = await params;
  if (!(await rateLimit("apply-cv-confirm", 40, 3600))) return fail(t("common.tooMany"), 429);

  const body = (await req.json().catch(() => null)) as { questionId?: unknown; name?: unknown } | null;
  const questionId = String(body?.questionId ?? "");
  const ext = String(body?.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (!CV_MIME[ext]) return fail(t("apply.cv.badType"), 400);

  const res = await cvContext(jobId, questionId);
  if ("error" in res) return fail(t(`apply.errors.${res.error}` as "apply.errors.closed"), res.status);
  const { db, maxMb, applicationId } = res.ctx;

  const path = `${applicationId}/cv.${ext}`;
  const { data: file } = await db.storage.from("resumes").download(path);
  if (!file) return fail(t("apply.errors.missingFile"), 400);
  const reject = async (message: string, status: number) => {
    await db.storage.from("resumes").remove([path]);
    return fail(message, status);
  };
  if (file.size === 0) return reject(t("apply.errors.fileEmpty"), 400);
  if (file.size > maxMb * 1024 * 1024) return reject(t("apply.cv.tooLarge", { mb: maxMb }), 413);
  if (!hasValidSignature(ext, new Uint8Array(await file.slice(0, 8).arrayBuffer()))) return reject(t("apply.errors.cvBadSignature"), 400);

  // Un CV déjà envoyé sous un autre nom (autre extension) est retiré.
  const { data: old } = await db.from("resumes").select("file_url").eq("application_id", applicationId).maybeSingle();
  if (old && old.file_url !== path) await db.storage.from("resumes").remove([old.file_url]);

  const { error } = await db
    .from("resumes")
    .upsert({ application_id: applicationId, file_url: path, parsed_data: null, parse_status: "pending" }, { onConflict: "application_id" });
  if (error) return fail(t("apply.errors.cannotSaveFile"), 500);

  after(() => parseResume(applicationId));
  return NextResponse.json({ ok: true });
}
