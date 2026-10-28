import { z } from "zod";

export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "number",
  "dropdown",
  "multiple_choice",
  "file_upload",
  "voice",
  "url",
  "assignment_text",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  dropdown: "Dropdown (single select)",
  multiple_choice: "Multiple choice",
  file_upload: "CV upload (PDF/Word)",
  voice: "Voice question",
  url: "URL / link",
  assignment_text: "Assignment / code text",
};

export const questionConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  min_length: z.number().int().min(0).optional(),
  max_length: z.number().int().min(1).optional(),
  options: z.array(z.string().min(1)).optional(),
  multiple: z.boolean().optional(),
  max_seconds: z.number().int().min(10).max(600).optional(),
  identity: z.enum(["email", "phone", "name"]).optional(),
  url_kind: z
    .enum(["linkedin", "behance", "portfolio", "assignment_video", "other"])
    .optional(),
});
export type QuestionConfig = z.infer<typeof questionConfigSchema>;

export const questionSchema = z.object({
  page_number: z.number().int().min(1),
  position: z.number().int().min(0),
  type: z.enum(QUESTION_TYPES),
  label: z.string().trim().min(1, "admin.errors.labelRequired"),
  required: z.boolean(),
  is_salary: z.boolean(),
  config: questionConfigSchema,
});
export type QuestionInput = z.infer<typeof questionSchema>;

export type QuestionRow = QuestionInput & { id: string };

export const DEFAULT_CONFIG: Record<QuestionType, QuestionConfig> = {
  short_text: { max_length: 200 },
  long_text: { max_length: 2000 },
  number: {},
  dropdown: { options: ["Option 1", "Option 2"] },
  multiple_choice: { options: ["Option 1", "Option 2"], multiple: false },
  file_upload: {},
  voice: { max_seconds: 180 },
  url: { url_kind: "other" },
  assignment_text: { max_length: 5000 },
};

const num = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().min(min).max(max).optional()
  );

export const criteriaSchema = z.object({
  required_skills: z.array(z.string()),
  min_years: z.number().min(0),
  traits: z.array(z.string()),
  responsibilities: z.string(),
  weights: z.object({
    skills: z.number().min(0).max(100),
    experience: z.number().min(0).max(100),
    assignment: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
  }),
});
export type Criteria = z.infer<typeof criteriaSchema>;

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;

export const WORK_MODE_LABELS: Record<(typeof WORK_MODES)[number], string> = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
};
export const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

// Un champ vide dans le formulaire devient "pas de valeur" (null).
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = z.preprocess(emptyToNull, z.string().trim().max(80).nullable());

export const jobFormSchema = z.object({
  department: optionalText,
  location: optionalText,
  work_mode: z.preprocess(emptyToNull, z.enum(WORK_MODES).nullable()),
  employment_type: z.preprocess(emptyToNull, z.enum(EMPLOYMENT_TYPES).nullable()),
  title: z.string().trim().min(1, "admin.errors.titleRequired"),
  reference: z.string().trim().optional(),
  description: z.string().trim().optional(),
  cv_max_mb: z.coerce.number().int().min(1).max(10),
  salary_min: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(1_000_000_000).nullable()),
  salary_max: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(1_000_000_000).nullable()),
  salary_currency: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z]{3}$/, "admin.errors.badSalary").nullable()),
  deadline: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "admin.errors.badDeadline").nullable()),
  assignment_enabled: z.boolean(),
  assignment_required: z.boolean(),
}).refine((j) => j.salary_min == null || j.salary_max == null || j.salary_min <= j.salary_max, {
  message: "admin.errors.badSalary",
  path: ["salary_max"],
});

const list = (s: FormDataEntryValue | null) =>
  String(s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function parseJobForm(fd: FormData) {
  const job = jobFormSchema.safeParse({
    title: fd.get("title"),
    reference: fd.get("reference") ?? "",
    description: fd.get("description") ?? "",
    department: fd.get("department") ?? "",
    location: fd.get("location") ?? "",
    work_mode: fd.get("work_mode") ?? "",
    employment_type: fd.get("employment_type") ?? "",
    cv_max_mb: fd.get("cv_max_mb") || 5,
    deadline: fd.get("deadline") ?? "",
    salary_min: fd.get("salary_min") ?? "",
    salary_max: fd.get("salary_max") ?? "",
    salary_currency: fd.get("salary_currency") ?? "",
    assignment_enabled: fd.get("assignment_enabled") === "on",
    assignment_required: fd.get("assignment_required") === "on",
  });
  const w = (k: string) => num(0, 100).parse(fd.get(`w_${k}`)) ?? 0;
  const criteria = criteriaSchema.safeParse({
    required_skills: list(fd.get("required_skills")),
    min_years: num(0, 60).parse(fd.get("min_years")) ?? 0,
    traits: list(fd.get("traits")),
    responsibilities: String(fd.get("responsibilities") ?? ""),
    weights: {
      skills: w("skills"),
      experience: w("experience"),
      assignment: w("assignment"),
      communication: w("communication"),
    },
  });
  return { job, criteria };
}
