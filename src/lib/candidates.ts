export const STATUS_LABELS: Record<string, string> = {
  incomplete: "Incomplete",
  submitted: "Submitted",
  under_review: "Under Review",
  shortlisted: "Shortlisted",
  interviewed: "Interviewed",
  evaluated: "Evaluated",
  final_recommendation_ready: "Final Recommendation Ready",
};

// Incomplete et Submitted sont automatiques : HR ne peut pas les choisir.
export const MANUAL_STATUSES = [
  "under_review",
  "shortlisted",
  "interviewed",
  "evaluated",
  "final_recommendation_ready",
] as const;

export const DECISIONS = [
  { value: "move_to_interview", label: "Move to Interview" },
  { value: "hire", label: "Hire" },
  { value: "reject", label: "Reject" },
  { value: "keep_in_pipeline", label: "Keep in Pipeline" },
] as const;

export type ParsedResume = {
  work_experience?: { company?: string | null; role?: string | null; start?: string | null; end?: string | null }[];
  education?: { institution?: string | null; degree?: string | null; field?: string | null; end?: string | null }[];
  skills?: string[];
  tools?: string[];
  certifications?: string[];
  languages?: string[];
};

const year = (v?: string | null) => {
  const m = v?.match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

// Estimation simple : somme des durées des postes (le chevauchement n'est pas géré).
export function yearsOfExperience(parsed: ParsedResume | null | undefined): number | null {
  const jobs = parsed?.work_experience;
  if (!jobs || jobs.length === 0) return null;
  const now = new Date().getFullYear();
  let total = 0;
  for (const j of jobs) {
    const start = year(j.start);
    if (start == null) continue;
    const end = year(j.end) ?? now;
    total += Math.max(0, end - start);
  }
  return total;
}

export function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (value == null || typeof value === "object") return "";
  return String(value);
}

export const RECOMMENDATION_LABELS: Record<string, string> = {
  suggest_interview: "Suggest Interview",
  keep_as_backup: "Keep as Backup",
  reject: "Reject",
};

// Couleur des étiquettes de statut et de recommandation.
export const STATUS_TONE: Record<string, "primary" | "good" | "warn" | "bad" | "info" | "neutral"> = {
  incomplete: "warn",
  submitted: "neutral",
  under_review: "info",
  shortlisted: "good",
  interviewed: "info",
  evaluated: "good",
  final_recommendation_ready: "good",
};

export const RECOMMENDATION_TONE: Record<string, "good" | "warn" | "bad"> = {
  suggest_interview: "good",
  keep_as_backup: "warn",
  reject: "bad",
};
