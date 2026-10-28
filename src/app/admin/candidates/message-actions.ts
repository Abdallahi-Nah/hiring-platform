"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { notifyCandidateMessage } from "@/lib/email/message";
import { broadcastToCandidate, type LiveMessage } from "@/lib/realtime";
import { buildTemplated } from "@/lib/email/templated";
import { sendMail } from "@/lib/email/transport";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MessageResult = { ok?: boolean; error?: string; message?: LiveMessage };

// Les règles RLS limitent l'écriture aux candidatures de l'entreprise.
export async function sendHrMessage(applicationId: string, body: string): Promise<MessageResult> {
  const user = await requireUser();
  const { t } = await getI18n();
  const text = body.trim();
  if (!text || text.length > 2000) return { error: t("hr1.chat.errLength") };

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("status, track_token").eq("id", applicationId).single();
  if (!app || app.status === "incomplete") return { error: t("admin.common.notFoundApp") };

  const { data: row, error } = await supabase
    .from("messages")
    .insert({
      application_id: applicationId,
      sender: "hr",
      sender_name: (user.fullName || user.email).slice(0, 80),
      body: text,
    })
    .select("id, sender, sender_name, body, created_at, delivered_at, read_at")
    .single();
  if (error || !row) return { error: t("hr1.chat.errSend") };
  await broadcastToCandidate(app.track_token, row);
  await notifyCandidateMessage(applicationId, await siteUrl());
  revalidatePath("/admin/messages");
  return { ok: true, message: row };
}

// Envoie l'invitation à l'entretien (modèle "invite" de l'entreprise ou texte par défaut).
export async function sendInvitation(applicationId: string): Promise<MessageResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("status, email").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") return { error: t("admin.errors.incompleteNoStatus") };
  if (!app.email) return { error: t("admin.errors.noCandidateEmail") };
  try {
    const mail = await buildTemplated(applicationId, "invite", await siteUrl());
    if (!mail) return { error: t("admin.errors.cannotSendEmail") };
    await sendMail(mail);
  } catch (e) {
    console.error("sendInvitation", applicationId, e);
    return { error: t("admin.errors.cannotSendEmail") };
  }
  return { ok: true };
}

// Invalide l'ancien lien de suivi du candidat (ex. lien transmis par erreur). Les prochains emails contiennent le nouveau lien.
export async function renewTrackLink(applicationId: string): Promise<MessageResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const supabase = await createClient();
  // Lecture protégée par RLS (la candidature doit être celle de l'entreprise), puis écriture par le serveur.
  const { data: app } = await supabase.from("applications").select("id").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  const { error } = await createAdminClient().from("applications").update({ track_token: crypto.randomUUID() }).eq("id", app.id);
  if (error) return { error: t("admin.common.notFoundApp") };
  revalidatePath("/admin/messages");
  return { ok: true };
}
