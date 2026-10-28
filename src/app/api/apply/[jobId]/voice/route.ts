import { after, NextResponse } from "next/server";
import { readSession } from "@/lib/applicant/session";
import { getI18n } from "@/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { transcribeAnswer } from "@/lib/ai/transcribe";
import { createAdminClient } from "@/lib/supabase/admin";

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const MAX_BYTES = 10 * 1024 * 1024;

// code : lets the browser react without reading the (translated) message.
const fail = (error: string, status: number, code?: string) =>
  NextResponse.json({ error, code }, { status });

function extensionFor(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { t } = await getI18n();
  const { jobId } = await params;
  if (!(await rateLimit("apply-voice", 40, 3600))) return fail(t("common.tooMany"), 429);
  const session = await readSession(jobId);
  if (!session) return fail(t("apply.errors.sessionExpired"), 401);

  const form = await req.formData().catch(() => null);
  const questionId = String(form?.get("questionId") ?? "");
  const file = form?.get("audio");
  if (!(file instanceof File)) return fail(t("apply.errors.missingAudio"), 400);

  const ext = extensionFor(file.type);
  if (!ext) return fail(t("apply.errors.unsupportedAudio"), 400);
  if (file.size === 0 || file.size > MAX_BYTES) return fail(t("apply.errors.invalidAudioSize"), 413);

  const db = createAdminClient();
  const { data: q } = await db
    .from("questions")
    .select("id, type, page_number, job_form_id")
    .eq("id", questionId)
    .single();
  if (!q || q.job_form_id !== jobId || q.type !== "voice" || q.page_number !== session.page) {
    return fail(t("apply.errors.invalidQuestion"), 400);
  }

  const { data: app } = await db
    .from("applications")
    .select("id, status")
    .eq("id", session.applicationId)
    .eq("job_form_id", jobId)
    .single();
  if (!app || app.status !== "incomplete") return fail(t("apply.errors.closed"), 403);

  // Une seule tentative par question.
  const path = `${app.id}/${q.id}.${ext}`;
  const { error: upErr } = await db.storage
    .from("audio")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return fail(t("apply.errors.alreadyRecorded"), 409, "exists");

  const { data: answer, error: insErr } = await db
    .from("answers")
    .insert({
      application_id: app.id,
      question_id: q.id,
      value: { audio_path: path },
      audio_url: path,
      transcript_status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !answer) {
    await db.storage.from("audio").remove([path]);
    return fail(t("apply.errors.alreadyRecorded"), 409, "exists");
  }

  after(() => transcribeAnswer(answer.id));
  return NextResponse.json({ ok: true });
}
