import { after, NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { MAX_ANSWER_SECONDS, MAX_VIDEO_BYTES, transcribeInterviewAnswer, VIDEO_TYPES } from "@/lib/ai/video-interview";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, code }, { status });

// Confirme une réponse : la vidéo est déjà dans Supabase Storage (envoi direct). On vérifie le fichier, puis on l'enregistre.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) return fail(t("ivid.errors.invalid"), 404);
  if (!(await rateLimit("iv-confirm", 120, 3600))) return fail(t("common.tooMany"), 429);

  const body = (await req.json().catch(() => null)) as { index?: unknown; seconds?: unknown; type?: unknown } | null;
  const index = Number(body?.index);
  const seconds = Math.round(Number(body?.seconds));
  const ext = typeof body?.type === "string" ? VIDEO_TYPES[body.type.split(";")[0].trim().toLowerCase()] : undefined;
  if (!Number.isInteger(index) || index < 0) return fail(t("ivid.errors.upload"), 400);
  if (!ext) return fail(t("ivid.errors.format"), 415);

  const db = createAdminClient();
  const { data: iv } = await db.from("ai_interviews").select("id, status, expires_at, questions").eq("token", token).single();
  if (!iv || !["invited", "in_progress"].includes(iv.status)) return fail(t("ivid.errors.closed"), 403);
  if (iv.expires_at && new Date(iv.expires_at) < new Date()) return fail(t("ivid.errors.expired"), 403);
  const total = Array.isArray(iv.questions) ? iv.questions.length : 0;
  if (index >= total) return fail(t("ivid.errors.upload"), 400);

  // Le fichier doit exister, avoir un format vidéo accepté et une taille correcte.
  const name = `${index}.${ext}`;
  const path = `${iv.id}/${name}`;
  const { data: files } = await db.storage.from("ai-interviews").list(iv.id, { limit: 100, search: String(index) });
  const file = files?.find((f) => f.name === name);
  if (!file) return fail(t("ivid.errors.upload"), 400);
  const size = Number((file.metadata as { size?: number } | null)?.size ?? 0);
  if (size < 1000 || size > MAX_VIDEO_BYTES) {
    await db.storage.from("ai-interviews").remove([path]);
    return fail(t("ivid.errors.size"), 413);
  }

  const { data: answer, error: insErr } = await db
    .from("ai_interview_answers")
    .insert({ interview_id: iv.id, question_index: index, video_path: path, duration_seconds: Math.min(Math.max(seconds || 0, 0), MAX_ANSWER_SECONDS + 15) })
    .select("id")
    .single();
  if (insErr || !answer) return fail(t("ivid.errors.exists"), 409, "exists");
  await db.from("ai_interviews").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", iv.id).eq("status", "invited");

  after(() => transcribeInterviewAnswer(answer.id));
  const { count } = await db.from("ai_interview_answers").select("id", { count: "exact", head: true }).eq("interview_id", iv.id);
  return NextResponse.json({ ok: true, answered: count ?? 0, total });
}
