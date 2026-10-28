import { after, NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { MAX_ANSWER_SECONDS, MAX_VIDEO_BYTES, transcribeInterviewAnswer, VIDEO_TYPES } from "@/lib/ai/video-interview";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, code }, { status });

// Le candidat envoie la vidéo d'une réponse (une seule tentative par question). Le jeton secret du lien fait office de session.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) return fail(t("ivid.errors.invalid"), 404);
  if (!(await rateLimit("iv-upload", 80, 3600))) return fail(t("common.tooMany"), 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(t("ivid.errors.upload"), 400);
  }
  const file = form.get("file");
  const index = Number(form.get("index"));
  const seconds = Math.round(Number(form.get("seconds")));
  if (!(file instanceof File) || !Number.isInteger(index) || index < 0) return fail(t("ivid.errors.upload"), 400);
  if (file.size < 1000 || file.size > MAX_VIDEO_BYTES) return fail(t("ivid.errors.size"), 413);
  const baseType = file.type.split(";")[0].trim().toLowerCase();
  const ext = VIDEO_TYPES[baseType];
  if (!ext) return fail(t("ivid.errors.format"), 415);

  const db = createAdminClient();
  const { data: iv } = await db.from("ai_interviews").select("id, status, expires_at, questions").eq("token", token).single();
  if (!iv || !["invited", "in_progress"].includes(iv.status)) return fail(t("ivid.errors.closed"), 403);
  if (iv.expires_at && new Date(iv.expires_at) < new Date()) return fail(t("ivid.errors.expired"), 403);
  const total = Array.isArray(iv.questions) ? iv.questions.length : 0;
  if (index >= total) return fail(t("ivid.errors.upload"), 400);

  const path = `${iv.id}/${index}.${ext}`;
  const { error: upErr } = await db.storage.from("ai-interviews").upload(path, file, { contentType: baseType, upsert: false });
  if (upErr) return fail(t("ivid.errors.exists"), 409, "exists");

  const { data: answer, error: insErr } = await db
    .from("ai_interview_answers")
    .insert({ interview_id: iv.id, question_index: index, video_path: path, duration_seconds: Math.min(Math.max(seconds || 0, 0), MAX_ANSWER_SECONDS + 15) })
    .select("id")
    .single();
  if (insErr || !answer) {
    await db.storage.from("ai-interviews").remove([path]);
    return fail(t("ivid.errors.exists"), 409, "exists");
  }
  await db.from("ai_interviews").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", iv.id).eq("status", "invited");

  after(() => transcribeInterviewAnswer(answer.id));
  const { count } = await db.from("ai_interview_answers").select("id", { count: "exact", head: true }).eq("interview_id", iv.id);
  return NextResponse.json({ ok: true, answered: count ?? 0, total });
}
