import { NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { CV_MIME, cvContext } from "@/lib/apply-cv";
import { rateLimit } from "@/lib/rate-limit";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

// Étape 1 : Vercel refuse les requêtes de plus de 4,5 Mo, donc le CV part directement vers Supabase Storage
// avec un lien d'envoi signé, valable pour ce seul fichier. L'étape 2 (/cv/confirm) vérifie le fichier reçu.
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { t } = await getI18n();
  const { jobId } = await params;
  if (!(await rateLimit("apply-cv", 40, 3600))) return fail(t("common.tooMany"), 429);

  const body = (await req.json().catch(() => null)) as { questionId?: unknown; name?: unknown; size?: unknown } | null;
  const questionId = String(body?.questionId ?? "");
  const ext = String(body?.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  const size = Number(body?.size);
  if (!CV_MIME[ext]) return fail(t("apply.cv.badType"), 400);
  if (!Number.isFinite(size) || size <= 0) return fail(t("apply.errors.fileEmpty"), 400);

  const res = await cvContext(jobId, questionId);
  if ("error" in res) return fail(t(`apply.errors.${res.error}` as "apply.errors.closed"), res.status);
  const { db, maxMb, applicationId } = res.ctx;
  if (size > maxMb * 1024 * 1024) return fail(t("apply.cv.tooLarge", { mb: maxMb }), 413);

  // upsert : un CV déjà envoyé est remplacé, et un envoi non confirmé (coupure réseau) peut être refait.
  const path = `${applicationId}/cv.${ext}`;
  const { data, error } = await db.storage.from("resumes").createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return fail(t("apply.errors.cannotUploadFile"), 500);
  return NextResponse.json({ ok: true, path: data.path, token: data.token, contentType: CV_MIME[ext] });
}
