import { after, NextResponse } from "next/server";
import { getI18n } from "@/i18n/server";
import { evaluateAiInterview } from "@/lib/ai/video-interview";
import { addNotification } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";

export const maxDuration = 300;

// Le candidat a répondu à toutes les questions : l'entretien est clos et l'évaluation IA démarre.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { t } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ error: t("ivid.errors.invalid") }, { status: 404 });
  if (!(await rateLimit("iv-finish", 30, 3600))) return NextResponse.json({ error: t("common.tooMany") }, { status: 429 });

  const db = createAdminClient();
  const { data: iv } = await db.from("ai_interviews").select("id, application_id, status, questions").eq("token", token).single();
  if (!iv) return NextResponse.json({ error: t("ivid.errors.invalid") }, { status: 404 });
  if (iv.status === "completed") return NextResponse.json({ ok: true });
  if (!["invited", "in_progress"].includes(iv.status)) return NextResponse.json({ error: t("ivid.errors.closed") }, { status: 403 });

  const total = Array.isArray(iv.questions) ? iv.questions.length : 0;
  const { count } = await db.from("ai_interview_answers").select("id", { count: "exact", head: true }).eq("interview_id", iv.id);
  if ((count ?? 0) < total) return NextResponse.json({ error: t("ivid.errors.incomplete") }, { status: 409 });

  const { data: updated } = await db
    .from("ai_interviews")
    .update({ status: "completed", completed_at: new Date().toISOString(), eval_status: "pending" })
    .eq("id", iv.id)
    .in("status", ["invited", "in_progress"])
    .select("id");
  if (updated?.length) {
    after(() => addNotification(iv.application_id, "interview"));
    after(() => evaluateAiInterview(iv.id, { waitForTranscripts: true }));
  }
  return NextResponse.json({ ok: true });
}
