"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { sendLiveInvite } from "@/lib/email/live-interview";
import { isLocale } from "@/lib/email/templated";
import { DURATIONS, MAX_DAYS_AHEAD } from "@/lib/live-interview";
import { rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

export type LiveResult = { ok?: boolean; error?: string };

// Vérifie (par RLS) que l'entretien appartient à l'entreprise de l'utilisateur, puis renvoie sa ligne.
async function ownLive(liveId: string) {
  if (!UUID.test(liveId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("live_interviews").select("id, application_id, status").eq("id", liveId).single();
  return data;
}

// Fixe (ou change) le rendez-vous puis envoie l'invitation par email. `whenIso` vient du navigateur du RH (son fuseau horaire).
export async function scheduleLiveInterview(applicationId: string, whenIso: string, minutes: number): Promise<LiveResult> {
  const user = await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  if (!UUID.test(applicationId)) return { error: t("admin.common.notFoundApp") };
  const when = new Date(whenIso);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 5 * 60_000) return { error: t("live.hr.errPast") };
  if (when.getTime() > Date.now() + MAX_DAYS_AHEAD * 864e5) return { error: t("live.hr.errFar", { days: MAX_DAYS_AHEAD }) };
  if (!(DURATIONS as readonly number[]).includes(minutes)) return { error: t("live.hr.errState") };
  if (!(await rateLimit("live-schedule", 40, 3600))) return { error: t("common.tooMany") };

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, status, locale").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") return { error: t("admin.errors.incompleteNoStatus") };
  const locale = isLocale(app.locale ?? "") ? (app.locale as "en" | "fr" | "ar") : "en";

  const db = createAdminClient();
  const { data: existing } = await supabase.from("live_interviews").select("id").eq("application_id", app.id).maybeSingle();
  let id = existing?.id;
  if (id) {
    const { error } = await db
      .from("live_interviews")
      .update({ scheduled_at: when.toISOString(), duration_minutes: minutes, locale, status: "scheduled", guest_joined_at: null, ended_at: null })
      .eq("id", id);
    if (error) return { error: t("live.hr.errState") };
  } else {
    const { data, error } = await db
      .from("live_interviews")
      .insert({ application_id: app.id, scheduled_at: when.toISOString(), duration_minutes: minutes, locale, created_by: user.id })
      .select("id")
      .single();
    if (error || !data) return { error: t("live.hr.errState") };
    id = data.id;
  }
  try {
    await sendLiveInvite(id, await siteUrl());
    await db.from("live_interviews").update({ invited_at: new Date().toISOString() }).eq("id", id);
  } catch (e) {
    console.error("scheduleLiveInterview", applicationId, e);
    // Un tout nouveau rendez-vous sans email n'a pas de sens : on le retire pour garder un état clair.
    if (!existing) await db.from("live_interviews").delete().eq("id", id);
    revalidatePath(`/admin/candidates/${app.id}`);
    return { error: t("admin.errors.cannotSendEmail") };
  }
  revalidatePath(`/admin/candidates/${app.id}`);
  return { ok: true };
}

// Renvoie l'invitation (même lien, même heure).
export async function resendLiveInvite(liveId: string): Promise<LiveResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const lv = await ownLive(liveId);
  if (!lv || lv.status !== "scheduled") return { error: t("live.hr.errState") };
  if (!(await rateLimit("live-resend", 40, 3600))) return { error: t("common.tooMany") };
  try {
    await sendLiveInvite(lv.id, await siteUrl());
  } catch (e) {
    console.error("resendLiveInvite", liveId, e);
    return { error: t("admin.errors.cannotSendEmail") };
  }
  revalidatePath(`/admin/candidates/${lv.application_id}`);
  return { ok: true };
}

// Annule le rendez-vous : le lien ne marche plus.
export async function cancelLiveInterview(liveId: string): Promise<LiveResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const lv = await ownLive(liveId);
  if (!lv || !["scheduled", "in_progress"].includes(lv.status)) return { error: t("live.hr.errState") };
  await createAdminClient().from("live_interviews").update({ status: "cancelled" }).eq("id", lv.id);
  revalidatePath(`/admin/candidates/${lv.application_id}`);
  return { ok: true };
}

// Le RH termine l'entretien pour tout le monde (depuis la salle).
export async function endLiveInterview(liveId: string): Promise<LiveResult> {
  await requireUser(["super_admin", "admin", "reviewer"]);
  const { t } = await getI18n();
  const lv = await ownLive(liveId);
  if (!lv || !["scheduled", "in_progress"].includes(lv.status)) return { error: t("live.hr.errState") };
  await createAdminClient().from("live_interviews").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", lv.id);
  revalidatePath(`/admin/candidates/${lv.application_id}`);
  return { ok: true };
}
