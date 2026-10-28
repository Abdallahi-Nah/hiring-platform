"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import type { MessageKey, TFunction } from "@/i18n/translate";
import { requireUser } from "@/lib/auth";
import { checkImport, type Issue } from "@/lib/jobs/csv";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type PreviewRow = { line: number; title: string; errors: string[]; warnings: string[]; ok: boolean };
export type PreviewResult = { error?: string; rows?: PreviewRow[]; ok?: number; bad?: number; warn?: number };
export type ImportResult = { error?: string; created?: number; skipped?: number };

const say = (t: TFunction, i: Issue) => {
  const vars = i.vars && i.vars.col ? { ...i.vars, col: String(i.vars.col) } : i.vars;
  return t(i.key as MessageKey, vars);
};

// Vérifie le fichier (rien n'est enregistré) : une ligne par offre, avec ses erreurs et ses avertissements.
export async function previewJobImport(text: string): Promise<PreviewResult> {
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  if (typeof text !== "string") return { error: t("imp.err.generic") };
  if (!(await rateLimit("job-import", 60, 3600))) return { error: t("common.tooMany") };

  const check = checkImport(text);
  if (check.fatal) return { error: say(t, check.fatal) };

  // Titres déjà présents dans l'entreprise (les règles RLS limitent à l'entreprise).
  const supabase = await createClient();
  const { data: existing } = await supabase.from("job_forms").select("title").in("title", check.rows.map((r) => r.title).filter(Boolean));
  const names = new Set((existing ?? []).map((j) => String(j.title).toLowerCase()));

  const rows: PreviewRow[] = check.rows.map((r) => {
    const warnings = r.warnings.map((w) => say(t, w));
    if (r.title && names.has(r.title.toLowerCase())) warnings.push(t("imp.warn.exists"));
    return { line: r.line, title: r.title, errors: r.issues.map((i) => say(t, i)), warnings, ok: r.issues.length === 0 };
  });
  return { rows, ok: rows.filter((r) => r.ok).length, bad: rows.filter((r) => !r.ok).length, warn: rows.filter((r) => r.warnings.length).length };
}

// Crée les offres valides, toutes inactives (brouillons). Le fichier est revérifié : l'aperçu n'est jamais cru sur parole.
export async function importJobs(text: string, addStandardQuestions: boolean): Promise<ImportResult> {
  const user = await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  if (typeof text !== "string") return { error: t("imp.err.generic") };
  if (!(await rateLimit("job-import-run", 20, 3600))) return { error: t("common.tooMany") };

  const check = checkImport(text);
  if (check.fatal) return { error: say(t, check.fatal) };
  const valid = check.rows.filter((r) => r.job && r.criteria);
  if (valid.length === 0) return { error: t("imp.err.none") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_forms")
    .insert(valid.map((r) => ({ ...r.job!, evaluation_criteria: r.criteria!, created_by: user.id, company_id: user.companyId, is_active: false })))
    .select("id");
  if (error || !data || data.length !== valid.length) {
    console.error("importJobs", error?.message);
    return { error: t("imp.err.generic") };
  }

  if (addStandardQuestions) {
    const questions = data.flatMap((j) => [
      { job_form_id: j.id, page_number: 1, position: 0, type: "short_text", label: "Full name", required: true, config: { identity: "name" } },
      { job_form_id: j.id, page_number: 1, position: 1, type: "short_text", label: "Email", required: true, config: { identity: "email" } },
      { job_form_id: j.id, page_number: 1, position: 2, type: "short_text", label: "Phone", required: false, config: { identity: "phone" } },
    ]);
    const { error: qerr } = await supabase.from("questions").insert(questions);
    if (qerr) {
      // Sans questions, les offres ne pourraient pas être activées : on annule tout plutôt que de laisser des brouillons incomplets.
      console.error("importJobs questions", qerr.message);
      await supabase.from("job_forms").delete().in("id", data.map((j) => j.id));
      return { error: t("imp.err.generic") };
    }
  }
  revalidatePath("/admin/jobs");
  return { created: valid.length, skipped: check.rows.length - valid.length };
}
