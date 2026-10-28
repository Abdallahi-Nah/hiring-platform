"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { evaluateApplication } from "@/lib/ai/evaluate";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { sendDecisionEmail } from "@/lib/email/decision";
import { MANUAL_STATUSES } from "@/lib/candidates";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; saved?: boolean } | null;

const hrSchema = z.object({
  hr_score: z.number().min(0).max(100).nullable(),
  hr_decision: z
    .enum(["move_to_interview", "hire", "reject", "keep_in_pipeline"])
    .nullable(),
  hr_notes: z.string().max(5000),
  reason_tags: z.array(z.string().trim().min(1).max(40)).max(20),
});

export async function saveHrEvaluation(
  applicationId: string,
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  const user = await requireUser();
  const { t } = await getI18n();
  const score = String(fd.get("hr_score") ?? "").trim();
  const parsed = hrSchema.safeParse({
    hr_score: score === "" ? null : Number(score),
    hr_decision: String(fd.get("hr_decision") ?? "") || null,
    hr_notes: String(fd.get("hr_notes") ?? ""),
    reason_tags: String(fd.get("reason_tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return { error: t("admin.errors.checkScore") };

  // Le client "utilisateur" applique les règles RLS : il faut voir la candidature pour l'évaluer.
  const supabase = await createClient();
  const { error } = await supabase.from("hr_evaluations").upsert(
    {
      application_id: applicationId,
      ...parsed.data,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id" }
  );
  if (error) return { error: t("admin.errors.cannotSaveEvaluation") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { saved: true };
}

export async function setCandidateStatus(
  applicationId: string,
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  await requireUser();
  const { t } = await getI18n();
  const status = String(fd.get("status") ?? "");
  if (!(MANUAL_STATUSES as readonly string[]).includes(status)) {
    return { error: t("admin.errors.invalidStatus") };
  }

  // On vérifie d'abord que l'utilisateur voit cette candidature.
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") {
    return { error: t("admin.errors.incompleteNoStatus") };
  }

  const { error } = await createAdminClient()
    .from("applications")
    .update({ status })
    .eq("id", applicationId);
  if (error) return { error: t("admin.errors.cannotUpdateStatus") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { saved: true };
}

export async function recalculateAiScore(
  applicationId: string,
  _prev: FormState
): Promise<FormState> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();

  // On vérifie d'abord que l'utilisateur voit cette candidature.
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("status")
    .eq("id", applicationId)
    .single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") {
    return { error: t("admin.errors.incompleteNoEval") };
  }

  await evaluateApplication(applicationId);
  revalidatePath(`/admin/candidates/${applicationId}`);

  const { data: ai } = await supabase
    .from("ai_evaluations")
    .select("status")
    .eq("application_id", applicationId)
    .single();
  return ai?.status === "done" ? { saved: true } : { error: t("admin.errors.evalFailed") };
}

// Envoie au candidat l'email d'acceptation ou de refus (Super Admin et Admin seulement).
export async function sendDecision(applicationId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();

  // On vérifie d'abord que l'utilisateur voit cette candidature (règles RLS).
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };

  const res = await sendDecisionEmail(applicationId, await siteUrl());
  if ("error" in res) {
    const messages = {
      notSet: t("admin.errors.decisionNotSet"),
      alreadySent: t("admin.errors.decisionAlreadySent"),
      noEmail: t("admin.errors.noCandidateEmail"),
      failed: t("admin.errors.cannotSendEmail"),
    };
    return { error: messages[res.error] };
  }
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

// Déplace une candidature vers un autre statut (tableau Kanban).
export async function moveCandidate(applicationId: string, status: string): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  const { t } = await getI18n();
  if (!(MANUAL_STATUSES as readonly string[]).includes(status)) return { error: t("admin.errors.invalidStatus") };
  const { data: app } = await (await createClient()).from("applications").select("status").eq("id", applicationId).single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") return { error: t("admin.errors.incompleteNoStatus") };
  const { error } = await createAdminClient().from("applications").update({ status }).eq("id", applicationId);
  if (error) return { error: t("admin.errors.cannotUpdateStatus") };
  revalidatePath("/admin/jobs", "layout");
  return { ok: true };
}
