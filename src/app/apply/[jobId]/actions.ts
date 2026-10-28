"use server";

import { today } from "@/lib/public-jobs";
import { after } from "next/server";
import { sendConfirmationEmail } from "@/lib/email/confirmation";
import { notifyNewApplication } from "@/lib/email/notify-hr";
import { addNotification } from "@/lib/notifications";
import { siteUrl } from "@/lib/site-url";
import { getI18n } from "@/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { evaluateApplication } from "@/lib/ai/evaluate";
import { parseResume } from "@/lib/ai/resume";
import { getCandidate } from "@/lib/candidate-auth";
import { parseExternalProfile } from "@/lib/ai/profiles";
import { clearSession, readSession, writeSession } from "@/lib/applicant/session";
import { validateAnswers } from "@/lib/applicant/validate";
import type { QuestionRow } from "@/lib/jobs/schema";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveResult = {
  error?: string;
  errors?: Record<string, string>;
  nextPage?: number;
  done?: boolean;
};

const QUESTION_COLS = "id, page_number, position, type, label, required, is_salary, config";

async function getActiveJob(jobId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("job_forms")
    .select("id, companies!inner(is_active)")
    .eq("id", jobId)
    .eq("is_active", true)
    .eq("companies.is_active", true)
    .or(`deadline.is.null,deadline.gte.${today()}`)
    .single();
  return data ? db : null;
}

async function getPages(db: ReturnType<typeof createAdminClient>, jobId: string) {
  const { data } = await db
    .from("questions")
    .select(QUESTION_COLS)
    .eq("job_form_id", jobId)
    .order("page_number")
    .order("position");
  const questions = (data ?? []) as QuestionRow[];
  const pages = [...new Set(questions.map((q) => q.page_number))].sort((a, b) => a - b);
  return { questions, pages };
}

// Candidat connecté : son CV de profil est copié dans la candidature (s'il y a une question CV et si le fichier est assez petit).
async function attachProfileCv(db: ReturnType<typeof createAdminClient>, userId: string, applicationId: string, jobId: string, hasCvQuestion: boolean) {
  if (!hasCvQuestion) return false;
  try {
    const [{ data: profile }, { data: job }] = await Promise.all([
      db.from("candidate_profiles").select("cv_path").eq("user_id", userId).maybeSingle(),
      db.from("job_forms").select("cv_max_mb").eq("id", jobId).single(),
    ]);
    if (!profile?.cv_path || !job) return false;
    const { data: file } = await db.storage.from("candidate-cv").download(profile.cv_path);
    if (!file || file.size === 0 || file.size > job.cv_max_mb * 1024 * 1024) return false;
    const ext = profile.cv_path.split(".").pop() ?? "pdf";
    const path = `${applicationId}/cv.${ext}`;
    const { error: upErr } = await db.storage.from("resumes").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
    if (upErr) return false;
    const { error } = await db
      .from("resumes")
      .upsert({ application_id: applicationId, file_url: path, parsed_data: null, parse_status: "pending" }, { onConflict: "application_id" });
    if (error) return false;
    after(() => parseResume(applicationId));
    return true;
  } catch (e) {
    console.error("attachProfileCv", e);
    return false;
  }
}

export async function startApplication(jobId: string, consent: boolean): Promise<{ page?: number; error?: string; cvAttached?: boolean }> {
  const { t } = await getI18n();
  if (consent !== true) return { error: t("apply.consentRequired") };
  if (!(await rateLimit("apply-start", 10, 3600))) return { error: t("common.tooMany") };
  const db = await getActiveJob(jobId);
  if (!db) return { error: t("apply.errors.notOpen") };
  const { pages, questions } = await getPages(db, jobId);
  if (pages.length === 0) return { error: t("apply.errors.noQuestions") };
  const me = await getCandidate();

  // Une nouvelle candidature à chaque démarrage : pas de reprise possible.
  const { data, error } = await db
    .from("applications")
    .insert({ job_form_id: jobId, consent_at: new Date().toISOString(), candidate_id: me?.id ?? null })
    .select("id")
    .single();
  if (error || !data) return { error: t("apply.errors.cannotStart") };

  await writeSession(jobId, { applicationId: data.id, page: pages[0] });
  const cvAttached = me ? await attachProfileCv(db, me.id, data.id, jobId, questions.some((q) => q.type === "file_upload")) : false;
  return { page: pages[0], cvAttached };
}

export async function savePage(
  jobId: string,
  page: number,
  values: Record<string, unknown>
): Promise<SaveResult> {
  const { t, locale } = await getI18n();
  if (!(await rateLimit("apply-save", 200, 3600))) return { error: t("common.tooMany") };
  const session = await readSession(jobId);
  if (!session) return { error: t("apply.errors.sessionExpired") };
  // Avance seulement : on n'accepte que la page en cours.
  if (session.page !== page) return { error: t("apply.errors.invalidPage") };

  const db = await getActiveJob(jobId);
  if (!db) return { error: t("apply.errors.notOpen") };

  const { data: app } = await db
    .from("applications")
    .select("id, status, job_form_id")
    .eq("id", session.applicationId)
    .single();
  if (!app || app.job_form_id !== jobId || app.status !== "incomplete") {
    return { error: t("apply.errors.closed") };
  }

  const { questions, pages } = await getPages(db, jobId);
  const pageQuestions = questions.filter((q) => q.page_number === page);
  const { errors, clean } = validateAnswers(pageQuestions, values, t);

  // Les questions vocales obligatoires doivent déjà être enregistrées.
  const requiredVoice = pageQuestions.filter((q) => q.type === "voice" && q.required);
  if (requiredVoice.length > 0) {
    const { data: got } = await db
      .from("answers")
      .select("question_id")
      .eq("application_id", app.id)
      .in("question_id", requiredVoice.map((q) => q.id));
    const have = new Set(got?.map((a) => a.question_id));
    for (const q of requiredVoice) {
      if (!have.has(q.id)) errors[q.id] = t("apply.validation.recordAnswer");
    }
  }

  // Un CV obligatoire doit déjà être envoyé.
  const requiredCv = pageQuestions.filter((q) => q.type === "file_upload" && q.required);
  if (requiredCv.length > 0) {
    const { data: resume } = await db
      .from("resumes")
      .select("id")
      .eq("application_id", app.id)
      .maybeSingle();
    if (!resume) {
      for (const q of requiredCv) errors[q.id] = t("apply.validation.uploadCv");
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const rows = Object.entries(clean).map(([question_id, value]) => ({
    application_id: app.id,
    question_id,
    value,
  }));
  if (rows.length > 0) {
    const { error } = await db
      .from("answers")
      .upsert(rows, { onConflict: "application_id,question_id" });
    if (error) return { error: t("apply.errors.cannotSave") };
  }

  // Liens LinkedIn / Behance / portfolio : enregistrés puis lus par l'IA.
  const profileRows = pageQuestions.flatMap((q) => {
    const kind = q.config.url_kind;
    const v = clean[q.id];
    if (q.type !== "url" || typeof v !== "string") return [];
    if (kind !== "linkedin" && kind !== "behance" && kind !== "portfolio") return [];
    return [{ application_id: app.id, type: kind, url: v }];
  });
  if (profileRows.length > 0) {
    const { data: created } = await db
      .from("external_profiles")
      .upsert(profileRows, { onConflict: "application_id,url", ignoreDuplicates: true })
      .select("id");
    for (const row of created ?? []) after(() => parseExternalProfile(row.id));
  }

  // Email / téléphone → candidature + détection de doublons.
  const identity: { email?: string; phone?: string } = {};
  for (const q of pageQuestions) {
    const v = clean[q.id];
    if (typeof v !== "string") continue;
    if (q.config.identity === "email") identity.email = v.toLowerCase();
    if (q.config.identity === "phone") identity.phone = v;
  }
  if (identity.email || identity.phone) {
    const update: Record<string, unknown> = { ...identity };
    const { data: me } = await db
      .from("applications")
      .select("email, phone")
      .eq("id", app.id)
      .single();
    const email = identity.email ?? me?.email;
    const phone = identity.phone ?? me?.phone;
    const quote = (v: string) => `"${v.replace(/[\\"]/g, "\\$&")}"`;
    const filters = [
      email && `email.eq.${quote(email)}`,
      phone && `phone.eq.${quote(phone)}`,
    ].filter(Boolean);
    if (filters.length > 0) {
      const { count } = await db
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("job_form_id", jobId)
        .neq("id", app.id)
        .or(filters.join(","));
      update.is_duplicate = (count ?? 0) > 0;
    }
    await db.from("applications").update(update).eq("id", app.id);
  }

  const next = pages[pages.indexOf(page) + 1];
  if (next == null) {
    const { error } = await db
      .from("applications")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), locale })
      .eq("id", app.id);
    if (error) return { error: t("apply.errors.cannotSubmit") };
    await clearSession(jobId);
    const baseUrl = await siteUrl();
    after(() => sendConfirmationEmail(app.id, locale, baseUrl));
    after(() => notifyNewApplication(app.id, baseUrl));
    after(() => addNotification(app.id, "application"));
    after(() => evaluateApplication(app.id, { waitForInputs: true }));
    return { done: true };
  }

  await writeSession(jobId, { applicationId: app.id, page: next });
  return { nextPage: next };
}
