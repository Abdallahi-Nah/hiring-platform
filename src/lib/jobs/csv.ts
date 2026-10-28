import { criteriaSchema, jobFormSchema, type Criteria } from "./schema";

export const MAX_IMPORT_ROWS = 100;
export const MAX_IMPORT_CHARS = 1_000_000;
export const DEFAULT_CV_MB = 5;

// Un problème : une clé de traduction (+ valeurs). Le serveur la traduit.
export type Issue = { key: string; vars?: Record<string, string | number> };
export type JobInsert = ReturnType<typeof jobFormSchema.parse>;
export type ImportRow = { line: number; title: string; issues: Issue[]; warnings: Issue[]; job?: JobInsert; criteria?: Criteria };
export type ImportCheck = { fatal?: Issue; rows: ImportRow[] };

export const TEMPLATE_COLUMNS = ["title", "description", "department", "location", "work_mode", "employment_type", "deadline", "salary_min", "salary_max", "salary_currency", "reference", "required_skills", "min_years"] as const;
export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

const TEMPLATE_ROWS: string[][] = [
  ["Backend Developer", "Build and scale our APIs with TypeScript and PostgreSQL.", "Engineering", "Nouakchott", "remote", "full_time", "2026-12-31", "3000", "4500", "USD", "ENG-001", "TypeScript|NestJS|PostgreSQL", "3"],
  ["HR Assistant", "Support recruiting and candidate communication.", "People", "Nouakchott", "onsite", "contract", "", "800", "1200", "USD", "", "Communication|Excel", "1"],
];

const quote = (v: string) => (/[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// Modèle téléchargeable : BOM pour qu'Excel lise bien l'UTF-8.
export const templateCsv = () => "﻿" + [TEMPLATE_COLUMNS as readonly string[], ...TEMPLATE_ROWS].map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";

// ---------- Lecture du CSV (séparateur , ; ou tabulation ; guillemets ; retours à la ligne dans les champs) ----------
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const count = (d: string) => {
    let n = 0;
    let q = false;
    for (const ch of firstLine) {
      if (ch === '"') q = !q;
      else if (!q && ch === d) n++;
    }
    return n;
  };
  const delimiter = ([",", ";", "\t"] as const).map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0];
  const sep = delimiter[1] > 0 ? delimiter[0] : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) endField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

// ---------- Colonnes et valeurs ----------
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const ALIASES: Record<TemplateColumn, string[]> = {
  title: ["title", "titre", "poste", "intitule", "job_title", "intitule_du_poste"],
  description: ["description", "desc", "details"],
  department: ["department", "departement", "service", "team", "equipe"],
  location: ["location", "lieu", "ville", "city", "localisation"],
  work_mode: ["work_mode", "workmode", "mode", "mode_de_travail", "mode_travail"],
  employment_type: ["employment_type", "employmenttype", "type", "contract", "contrat", "type_de_contrat"],
  deadline: ["deadline", "date_limite", "closing_date", "date_de_cloture"],
  salary_min: ["salary_min", "salaire_min", "min_salary", "salaire_minimum"],
  salary_max: ["salary_max", "salaire_max", "max_salary", "salaire_maximum"],
  salary_currency: ["salary_currency", "currency", "devise", "monnaie"],
  reference: ["reference", "ref"],
  required_skills: ["required_skills", "skills", "competences", "competences_requises"],
  min_years: ["min_years", "years", "experience", "annees_experience", "min_experience"],
};
const HEADER_TO_COLUMN = new Map<string, TemplateColumn>(TEMPLATE_COLUMNS.flatMap((c) => ALIASES[c].map((a) => [a, c] as const)));

const MODES: Record<string, string> = { onsite: "onsite", on_site: "onsite", sur_site: "onsite", presentiel: "onsite", hybrid: "hybrid", hybride: "hybrid", remote: "remote", teletravail: "remote", a_distance: "remote" };
const TYPES: Record<string, string> = { full_time: "full_time", fulltime: "full_time", temps_plein: "full_time", cdi: "full_time", part_time: "part_time", parttime: "part_time", temps_partiel: "part_time", contract: "contract", contrat: "contract", cdd: "contract", freelance: "contract", internship: "internship", intern: "internship", stage: "internship", stagiaire: "internship" };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (s: string | undefined) => (s ?? "").replace(CONTROL, "").trim();

const toIsoDate = (raw: string) => {
  const m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return raw;
  const d = new Date(`${iso}T00:00:00Z`);
  // Une date au bon format mais impossible (31 février) devient une valeur que le formulaire refuse.
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? "invalid-date" : iso;
};

const toInt = (raw: string) => {
  const v = raw.replace(/[\s ']/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(v)) return v.replace(/[.,]/g, "");
  if (/^\d+([.,]0+)?$/.test(v)) return v.replace(/[.,].*$/, "");
  return raw;
};

const today = () => new Date().toISOString().slice(0, 10);

// Lit le texte du fichier et valide chaque ligne avec les mêmes règles que le formulaire "Nouvelle offre".
export function checkImport(text: string): ImportCheck {
  if (text.length > MAX_IMPORT_CHARS) return { fatal: { key: "imp.err.tooBig" }, rows: [] };
  const table = parseCsv(text);
  if (table.length < 2) return { fatal: { key: "imp.err.empty" }, rows: [] };
  const index = new Map<TemplateColumn, number>();
  table[0].forEach((h, i) => {
    const c = HEADER_TO_COLUMN.get(norm(h));
    if (c && !index.has(c)) index.set(c, i);
  });
  if (!index.has("title")) return { fatal: { key: "imp.err.noTitle" }, rows: [] };
  const body = table.slice(1);
  if (body.length > MAX_IMPORT_ROWS) return { fatal: { key: "imp.err.tooMany", vars: { max: MAX_IMPORT_ROWS } }, rows: [] };

  const seen = new Map<string, number>();
  const rows = body.map((cells, n): ImportRow => {
    const line = n + 2;
    const get = (c: TemplateColumn) => clean(cells[index.get(c) ?? -1]);
    const title = get("title");
    const issues: Issue[] = [];
    const warnings: Issue[] = [];
    if (!title) return { line, title: "", issues: [{ key: "imp.err.missingTitle" }], warnings };
    if (title.length > 150) issues.push({ key: "imp.err.titleLong" });
    const description = (cells[index.get("description") ?? -1] ?? "").replace(CONTROL, "").trim();
    if (description.length > 10_000) issues.push({ key: "imp.err.descLong" });

    const workMode = get("work_mode");
    const empType = get("employment_type");
    const parsed = jobFormSchema.safeParse({
      title,
      reference: get("reference"),
      description,
      department: get("department"),
      location: get("location"),
      work_mode: MODES[norm(workMode)] ?? workMode,
      employment_type: TYPES[norm(empType)] ?? empType,
      cv_max_mb: DEFAULT_CV_MB,
      deadline: toIsoDate(get("deadline")),
      salary_min: toInt(get("salary_min")),
      salary_max: toInt(get("salary_max")),
      salary_currency: get("salary_currency"),
      assignment_enabled: false,
      assignment_required: false,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.message.startsWith("admin.") ? issue.message : "imp.err.field";
        const col = String(issue.path[0] ?? "");
        if (!issues.some((x) => x.key === key && x.vars?.col === col)) issues.push({ key, vars: { col } });
      }
    }

    const skills = get("required_skills").split(/[;|,]/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
    const years = get("min_years") ? Number(toInt(get("min_years"))) : 0;
    const criteria = criteriaSchema.safeParse({
      required_skills: skills,
      min_years: Number.isFinite(years) ? years : NaN,
      traits: [],
      responsibilities: "",
      weights: { skills: 25, experience: 25, assignment: 25, communication: 25 },
    });
    if (!criteria.success || years < 0 || years > 60) issues.push({ key: "imp.err.field", vars: { col: "min_years" } });

    const dup = `${title.toLowerCase()}|${get("reference").toLowerCase()}`;
    if (seen.has(dup)) warnings.push({ key: "imp.warn.dupFile", vars: { line: seen.get(dup)! } });
    else seen.set(dup, line);
    if (parsed.success && parsed.data.deadline && parsed.data.deadline < today()) warnings.push({ key: "imp.warn.past" });

    return { line, title, issues, warnings, job: issues.length === 0 && parsed.success ? parsed.data : undefined, criteria: issues.length === 0 && criteria.success ? criteria.data : undefined };
  });
  return { rows };
}
