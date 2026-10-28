"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { evaluateAiInterview, generateInterviewQuestions, INVITE_DAYS, MAX_QUESTIONS, MIN_QUESTIONS } from "@/lib/ai/video-interview";
import { sendInterviewInvite } from "@/lib/email/interview";
import { isLocale } from "@/lib/email/templated";
import { rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

export type IvResult = { ok?: boolean; error?: string };

// Vérifie (par RLS) que l'entretien appartient à l'entreprise de l'utilisateur, puis renvoie sa ligne.
async function ownInterview(interviewId: string) {
  if (!UUID.test(interviewId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("ai_interviews").select("id, application_id, status, locale, questions").eq("id", interviewId).single();
  return data;
}

// Crée l'entretien : l'IA écrit les questions (modifiables tant que l'invitation n'est pas envoyée).
export async function createAiInterview(applicationId: string): Promise<IvResult> {
  const user = await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  if (!UUID.test(applicationId)) return { error: t("admin.common.notFoundApp") };
  if (!(await rateLimit("ai-iv-create", 30, 3600))) return { error: t("common.tooMany") };
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, status, locale").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") return { error: t("admin.errors.incompleteNoStatus") };
  const locale = isLocale(app.locale ?? "") ? (app.locale as "en" | "fr" | "ar") : "en";
  try {
    const questions = await generateInterviewQuestions(app.id, locale);
    const { error } = await createAdminClient()
      .from("ai_interviews")
      .upsert({ application_id: app.id, status: "draft", locale, questions: questions.map((text) => ({ text })), created_by: user.id }, { onConflict: "application_id", ignoreDuplicates: true });
    if (error) throw error;
  } catch (e) {
    console.error("createAiInterview", applicationId, e);
    return { error: t("ivid.hr.errGenerate") };
  }
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

// Réécrit les questions avec l'IA (brouillon seulement).
export async function regenerateAiQuestions(interviewId: string): Promise<IvResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const iv = await ownInterview(interviewId);
  if (!iv || iv.status !== "draft") return { error: t("ivid.hr.errState") };
  if (!(await rateLimit("ai-iv-create", 30, 3600))) return { error: t("common.tooMany") };
  try {
    const questions = await generateInterviewQuestions(iv.application_id, iv.locale as "en" | "fr" | "ar");
    await createAdminClient().from("ai_interviews").update({ questions: questions.map((text) => ({ text })) }).eq("id", iv.id);
  } catch (e) {
    console.error("regenerateAiQuestions", interviewId, e);
    return { error: t("ivid.hr.errGenerate") };
  }
  revalidatePath(`/admin/candidates/${iv.application_id}`);
  return { ok: true };
}

// Enregistre les questions modifiées par les RH (brouillon seulement).
export async function saveAiQuestions(interviewId: string, questions: string[]): Promise<IvResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const iv = await ownInterview(interviewId);
  if (!iv || iv.status !== "draft") return { error: t("ivid.hr.errState") };
  const clean = questions.map((q) => q.trim()).filter(Boolean);
  if (clean.length < MIN_QUESTIONS || clean.length > MAX_QUESTIONS || clean.some((q) => q.length > 300)) {
    return { error: t("ivid.hr.errCount", { min: MIN_QUESTIONS, max: MAX_QUESTIONS }) };
  }
  await createAdminClient().from("ai_interviews").update({ questions: clean.map((text) => ({ text })) }).eq("id", iv.id);
  revalidatePath(`/admin/candidates/${iv.application_id}`);
  return { ok: true };
}

// Envoie (ou renvoie) l'invitation : le lien est valable 7 jours.
export async function sendAiInterview(interviewId: string): Promise<IvResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const iv = await ownInterview(interviewId);
  if (!iv || iv.status === "completed") return { error: t("ivid.hr.errState") };
  if (!Array.isArray(iv.questions) || iv.questions.length < MIN_QUESTIONS) return { error: t("ivid.hr.errCount", { min: MIN_QUESTIONS, max: MAX_QUESTIONS }) };
  if (!(await rateLimit("ai-iv-send", 40, 3600))) return { error: t("common.tooMany") };
  const db = createAdminClient();
  const now = new Date();
  const { error } = await db
    .from("ai_interviews")
    .update({ status: iv.status === "draft" ? "invited" : iv.status, invited_at: now.toISOString(), expires_at: new Date(now.getTime() + INVITE_DAYS * 864e5).toISOString() })
    .eq("id", iv.id);
  if (error) return { error: t("ivid.hr.errSend") };
  try {
    await sendInterviewInvite(iv.id, await siteUrl());
  } catch (e) {
    console.error("sendAiInterview", interviewId, e);
    // L'email n'est pas parti : un brouillon reste un brouillon (le message d'erreur reste visible) ; une relance garde son lien.
    if (iv.status === "draft") await db.from("ai_interviews").update({ status: "draft", invited_at: null, expires_at: null }).eq("id", iv.id);
    revalidatePath(`/admin/candidates/${iv.application_id}`);
    return { error: t("admin.errors.cannotSendEmail") };
  }
  revalidatePath(`/admin/candidates/${iv.application_id}`);
  return { ok: true };
}

// Relance l'évaluation IA (par exemple si elle a échoué ou si le candidat n'a pas fini).
export async function reevaluateAiInterview(interviewId: string): Promise<IvResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const iv = await ownInterview(interviewId);
  if (!iv) return { error: t("ivid.hr.errState") };
  if (!(await rateLimit("ai-iv-eval", 30, 3600))) return { error: t("common.tooMany") };
  const { count } = await createAdminClient().from("ai_interview_answers").select("id", { count: "exact", head: true }).eq("interview_id", iv.id);
  if (!count) return { error: t("ivid.hr.errNoAnswers") };
  await createAdminClient().from("ai_interviews").update({ eval_status: "pending" }).eq("id", iv.id);
  after(() => evaluateAiInterview(iv.id, { waitForTranscripts: true }));
  revalidatePath(`/admin/candidates/${iv.application_id}`);
  return { ok: true };
}

// Supprime l'entretien et ses vidéos.
export async function deleteAiInterview(interviewId: string): Promise<IvResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const iv = await ownInterview(interviewId);
  if (!iv) return { error: t("ivid.hr.errState") };
  const db = createAdminClient();
  // Tout le dossier de l'entretien : aussi les vidéos envoyées mais jamais confirmées.
  const { data: files } = await db.storage.from("ai-interviews").list(iv.id, { limit: 100 });
  const paths = (files ?? []).map((f) => `${iv.id}/${f.name}`);
  if (paths.length) {
    const { error } = await db.storage.from("ai-interviews").remove(paths);
    if (error) return { error: t("ivid.hr.errDelete") };
  }
  await db.from("ai_interviews").delete().eq("id", iv.id);
  revalidatePath(`/admin/candidates/${iv.application_id}`);
  return { ok: true };
}

