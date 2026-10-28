import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "./transport";
import { buildTemplated } from "./templated";

export type DecisionResult = { ok: true } | { error: "notSet" | "alreadySent" | "noEmail" | "failed" };

// Envoie au candidat l'email d'acceptation (hire) ou de refus (reject), une seule fois.
// Jamais de score ni de note interne dans le message.
export async function sendDecisionEmail(applicationId: string, baseUrl = ""): Promise<DecisionResult> {
  const db = createAdminClient();
  const [{ data: app }, { data: hr }] = await Promise.all([
    db
      .from("applications")
      .select("email, decision_email_sent_at")
      .eq("id", applicationId)
      .single(),
    db.from("hr_evaluations").select("hr_decision").eq("application_id", applicationId).maybeSingle(),
  ]);
  if (!app) return { error: "failed" };
  const decision = hr?.hr_decision;
  if (decision !== "hire" && decision !== "reject") return { error: "notSet" };
  if (app.decision_email_sent_at) return { error: "alreadySent" };
  if (!app.email) return { error: "noEmail" };

  // On "réserve" l'envoi : un seul appel peut réussir.
  const { data: claimed } = await db
    .from("applications")
    .update({ decision_email_sent_at: new Date().toISOString() })
    .eq("id", applicationId)
    .is("decision_email_sent_at", null)
    .select("id")
    .single();
  if (!claimed) return { error: "alreadySent" };

  try {
    const mail = await buildTemplated(applicationId, decision === "hire" ? "offer" : "reject", baseUrl);
    if (!mail) throw new Error("no mail");
    await sendMail(mail);
    return { ok: true };
  } catch (e) {
    console.error("sendDecisionEmail", applicationId, e);
    await db.from("applications").update({ decision_email_sent_at: null }).eq("id", applicationId);
    return { error: "failed" };
  }
}
