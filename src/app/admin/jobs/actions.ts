"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import type { MessageKey, TFunction } from "@/i18n/translate";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseJobForm, questionSchema, type QuestionRow } from "@/lib/jobs/schema";

const STAFF = ["super_admin", "admin"] as const;

export type FormState = { error: string } | null;

// Les messages de validation (zod) sont des clés de traduction : on les traduit ici.
const zodText = (t: TFunction, msg?: string) =>
  msg?.startsWith("admin.") ? t(msg as MessageKey) : (msg ?? t("admin.common.invalidData"));

function firstError(t: TFunction, ...results: { success: boolean; error?: z.ZodError }[]) {
  for (const r of results) {
    if (!r.success) return zodText(t, r.error?.issues[0]?.message);
  }
  return null;
}

export async function createJob(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser([...STAFF]);
  const { t } = await getI18n();
  const { job, criteria } = parseJobForm(fd);
  const err = firstError(t, job, criteria);
  if (err || !job.success || !criteria.success) return { error: err ?? t("admin.common.invalidData") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_forms")
    .insert({
      ...job.data,
      evaluation_criteria: criteria.data,
      created_by: user.id,
      company_id: user.companyId,
    })
    .select("id")
    .single();
  if (error || !data) return { error: t("admin.errors.cannotCreateJob") };
  redirect(`/admin/jobs/${data.id}`);
}

export async function updateJob(
  id: string,
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();
  const { job, criteria } = parseJobForm(fd);
  const err = firstError(t, job, criteria);
  if (err || !job.success || !criteria.success) return { error: err ?? t("admin.common.invalidData") };

  const supabase = await createClient();
  const { error } = await supabase
    .from("job_forms")
    .update({ ...job.data, evaluation_criteria: criteria.data })
    .eq("id", id);
  if (error) return { error: t("admin.errors.cannotSaveJob") };
  revalidatePath(`/admin/jobs/${id}`);
  return null;
}

export async function setJobActive(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();
  const supabase = await createClient();

  if (isActive) {
    const { data: qs } = await supabase
      .from("questions")
      .select("type, config")
      .eq("job_form_id", id);
    const hasEmail = qs?.some(
      (q) => q.type === "short_text" && q.config?.identity === "email"
    );
    if (!hasEmail) {
      return { error: t("admin.errors.needEmailQuestion") };
    }
  }

  await supabase.from("job_forms").update({ is_active: isActive }).eq("id", id);
  revalidatePath(`/admin/jobs/${id}`);
  revalidatePath("/admin/jobs");
  return {};
}

// Copie l'offre et ses questions. La copie est inactive, sans date limite.
export async function duplicateJob(id: string): Promise<{ error?: string }> {
  const user = await requireUser([...STAFF]);
  const { t } = await getI18n();
  const supabase = await createClient();

  const { data: src } = await supabase.from("job_forms").select("*").eq("id", id).single();
  if (!src) return { error: t("admin.errors.cannotCreateJob") };

  const { id: _id, created_at: _c, is_active: _a, deadline: _d, ...fields } = src;
  const { data: copy, error } = await supabase
    .from("job_forms")
    .insert({
      ...fields,
      title: `${src.title} ${t("admin.jobForm.copySuffix")}`.slice(0, 200),
      is_active: false,
      deadline: null,
      created_by: user.id,
      company_id: user.companyId,
    })
    .select("id")
    .single();
  if (error || !copy) return { error: t("admin.errors.cannotCreateJob") };

  const { data: qs } = await supabase
    .from("questions")
    .select("page_number, position, type, label, required, is_salary, config")
    .eq("job_form_id", id);
  if (qs?.length) {
    const { error: qerr } = await supabase.from("questions").insert(qs.map((q) => ({ ...q, job_form_id: copy.id })));
    if (qerr) {
      await supabase.from("job_forms").delete().eq("id", copy.id);
      return { error: t("admin.errors.cannotCreateJob") };
    }
  }
  revalidatePath("/admin/jobs");
  redirect(`/admin/jobs/${copy.id}`);
}

export async function deleteJob(id: string) {
  await requireUser([...STAFF]);
  const supabase = await createClient();
  await supabase.from("job_forms").delete().eq("id", id);
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs");
}

export async function addQuestion(
  jobId: string,
  input: unknown
): Promise<{ question?: QuestionRow; error?: string }> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: zodText(t, parsed.error.issues[0].message) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({ ...parsed.data, job_form_id: jobId })
    .select("id, page_number, position, type, label, required, is_salary, config")
    .single();
  if (error || !data) return { error: t("admin.errors.cannotAddQuestion") };
  return { question: data as QuestionRow };
}

export async function updateQuestion(
  id: string,
  input: unknown
): Promise<{ error?: string }> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: zodText(t, parsed.error.issues[0].message) };

  const supabase = await createClient();
  const { error } = await supabase.from("questions").update(parsed.data).eq("id", id);
  return error ? { error: t("admin.errors.cannotSaveQuestion") } : {};
}

export async function deleteQuestion(id: string) {
  await requireUser([...STAFF]);
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", id);
}

const orderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    page_number: z.number().int().min(1),
    position: z.number().int().min(0),
  })
);

export async function reorderQuestions(input: unknown): Promise<{ error?: string }> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: t("admin.errors.invalidOrder") };

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map(({ id, page_number, position }) =>
      supabase.from("questions").update({ page_number, position }).eq("id", id)
    )
  );
  return results.some((r) => r.error) ? { error: t("admin.errors.cannotSaveOrder") } : {};
}
