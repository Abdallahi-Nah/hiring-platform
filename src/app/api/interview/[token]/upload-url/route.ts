import { NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { VIDEO_TYPES } from "@/lib/ai/interview-config";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";

const fail = (error: string, status: number, code?: string) => NextResponse.json({ error, code }, { status });

// Vercel refuse les requêtes de plus de 4,5 Mo : la vidéo part donc directement vers Supabase Storage,
// avec un lien d'envoi signé valable pour ce seul fichier. Le jeton secret du lien tient lieu de session.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) return fail(t("ivid.errors.invalid"), 404);
  if (!(await rateLimit("iv-upload", 120, 3600))) return fail(t("common.tooMany"), 429);

  const body = (await req.json().catch(() => null)) as { index?: unknown; type?: unknown } | null;
  const index = Number(body?.index);
  const ext = typeof body?.type === "string" ? VIDEO_TYPES[body.type.split(";")[0].trim().toLowerCase()] : undefined;
  if (!Number.isInteger(index) || index < 0) return fail(t("ivid.errors.upload"), 400);
  if (!ext) return fail(t("ivid.errors.format"), 415);

  const db = createAdminClient();
  const { data: iv } = await db.from("ai_interviews").select("id, status, expires_at, questions").eq("token", token).single();
  if (!iv || !["invited", "in_progress"].includes(iv.status)) return fail(t("ivid.errors.closed"), 403);
  if (iv.expires_at && new Date(iv.expires_at) < new Date()) return fail(t("ivid.errors.expired"), 403);
  if (index >= (Array.isArray(iv.questions) ? iv.questions.length : 0)) return fail(t("ivid.errors.upload"), 400);

  // Une seule tentative : une question déjà enregistrée ne peut plus recevoir de vidéo.
  const { count } = await db.from("ai_interview_answers").select("id", { count: "exact", head: true }).eq("interview_id", iv.id).eq("question_index", index);
  if (count) return fail(t("ivid.errors.exists"), 409, "exists");

  const path = `${iv.id}/${index}.${ext}`;
  // upsert : si un envoi précédent a réussi sans être confirmé (coupure réseau), le candidat peut renvoyer.
  const { data, error } = await db.storage.from("ai-interviews").createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return fail(t("ivid.errors.upload"), 500);
  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
