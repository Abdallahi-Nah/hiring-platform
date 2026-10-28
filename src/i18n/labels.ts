import type { MessageKey, TFunction } from "./translate";

// Libellés traduits pour les valeurs stockées en base (statut, recommandation, décision, rôle, type de question).
// Une valeur inconnue est affichée telle quelle.
const make = (prefix: string, known: readonly string[]) => (t: TFunction, value: string | null | undefined) =>
  value && known.includes(value) ? t(`${prefix}.${value}` as MessageKey) : (value ?? "");

export const statusLabel = make("admin.status", [
  "incomplete", "submitted", "under_review", "shortlisted", "interviewed", "evaluated", "final_recommendation_ready",
]);
export const recommendationLabel = make("admin.recommendation", ["suggest_interview", "keep_as_backup", "reject"]);
export const decisionLabel = make("admin.decision", ["move_to_interview", "hire", "reject", "keep_in_pipeline"]);
export const roleLabel = make("admin.roles", ["super_admin", "admin", "reviewer"]);
export const questionTypeLabel = make("admin.builder.types", [
  "short_text", "long_text", "number", "dropdown", "multiple_choice", "file_upload", "voice", "url", "assignment_text",
]);
export const employmentLabel = make("jobs.employment", ["full_time", "part_time", "contract", "internship"]);
export const workModeLabel = make("jobs.workMode", ["onsite", "hybrid", "remote"]);
