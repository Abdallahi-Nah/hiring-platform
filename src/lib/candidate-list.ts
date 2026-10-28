import type { SupabaseClient } from "@supabase/supabase-js";
import { inDateRange, validDate } from "@/lib/paginate";
import { answerText, yearsOfExperience, type ParsedResume } from "@/lib/candidates";

// Filtres partagés par la liste à l'écran et par l'export "Filtered subset".
export type Filters = {
  q: string;
  status: string;
  dup: string;
  skill: string;
  minYears: number;
  view: string;
  sort: string;
  from: string;
  to: string;
};

export function parseFilters(get: (key: string) => string): Filters {
  return {
    q: get("q").trim().toLowerCase(),
    status: get("status"),
    dup: get("dup"),
    skill: get("skill").trim().toLowerCase(),
    minYears: Number(get("min_years")) || 0,
    view: get("view"),
    sort: get("sort"),
    from: validDate(get("from")),
    to: validDate(get("to")),
  };
}

export type QuestionCol = { id: string; label: string; type: string; is_salary: boolean };

export type CandidateRow = {
  id: string;
  status: string;
  email: string | null;
  phone: string | null;
  is_duplicate: boolean;
  created_at: string;
  name: string;
  years: number | null;
  skills: string[];
  score: number | null;
  rank: number | null;
  recommendation: string | null;
  hrScore: number | null;
  hrDecision: string | null;
  interviewScore: number | null;
  haystack: string;
  answers: Map<string, string | number>;
};

type Db = SupabaseClient;

// Charge tous les candidats d'un job (max 1000). Les règles RLS cachent le salaire au Reviewer.
export async function loadCandidates(supabase: Db, jobId: string) {
  const { data: job } = await supabase
    .from("job_forms")
    .select("id, title")
    .eq("id", jobId)
    .single();
  if (!job) return null;

  // Requête dynamique (colonnes données en texte) : le type des lignes est donné à la main.
  const inJob = async <T,>(table: string, cols: string): Promise<{ data: T[] | null }> => {
    const { data } = await supabase
      .from(table)
      .select(`${cols}, applications!inner(job_form_id)`)
      .eq("applications.job_form_id", jobId);
    return { data: data as unknown as T[] | null };
  };

  const [{ data: apps }, { data: questions }, { data: answers }, { data: resumes }, { data: evals }, { data: hrs }, { data: interviews }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id, status, email, phone, is_duplicate, created_at")
        .eq("job_form_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("questions")
        .select("id, label, type, is_salary, config, page_number, position")
        .eq("job_form_id", jobId)
        .order("page_number")
        .order("position"),
      inJob<{ application_id: string; question_id: string; value: unknown; clean_transcript: string | null }>(
        "answers",
        "application_id, question_id, value, clean_transcript"
      ),
      inJob<{ application_id: string; parsed_data: ParsedResume | null }>("resumes", "application_id, parsed_data"),
      inJob<{ application_id: string; score: number | null; rank: number | null; recommendation: string | null }>(
        "ai_evaluations",
        "application_id, score, rank, recommendation"
      ),
      inJob<{ application_id: string; hr_score: number | null; hr_decision: string | null }>(
        "hr_evaluations",
        "application_id, hr_score, hr_decision"
      ),
      inJob<{ application_id: string; score: number | null }>("interviews", "application_id, score"),
    ]);

  const questionList = questions ?? [];
  const nameQuestionIds = new Set(questionList.filter((q) => q.config?.identity === "name").map((q) => q.id));
  const typeOf = new Map(questionList.map((q) => [q.id, q.type]));

  const resumeBy = new Map((resumes ?? []).map((r) => [r.application_id, r.parsed_data as ParsedResume | null]));
  const evalBy = new Map((evals ?? []).map((e) => [e.application_id, e]));
  const hrBy = new Map((hrs ?? []).map((h) => [h.application_id, h]));
  const interviewBy = new Map<string, number | null>();
  for (const i of interviews ?? []) interviewBy.set(i.application_id, i.score ?? interviewBy.get(i.application_id) ?? null);

  const textBy = new Map<string, string[]>();
  const nameBy = new Map<string, string>();
  const answersBy = new Map<string, Map<string, string | number>>();
  for (const a of answers ?? []) {
    const text = answerText(a.value);
    const cell: string | number | null =
      typeOf.get(a.question_id) === "voice"
        ? a.clean_transcript
        : typeof a.value === "number"
          ? a.value
          : text || null;

    const list = textBy.get(a.application_id) ?? [];
    list.push(text, a.clean_transcript ?? "");
    textBy.set(a.application_id, list);
    if (nameQuestionIds.has(a.question_id) && text) nameBy.set(a.application_id, text);

    if (cell != null) {
      const map = answersBy.get(a.application_id) ?? new Map();
      map.set(a.question_id, cell);
      answersBy.set(a.application_id, map);
    }
  }

  const rows: CandidateRow[] = (apps ?? []).map((a) => {
    const parsed = resumeBy.get(a.id) ?? null;
    const ai = evalBy.get(a.id);
    const hr = hrBy.get(a.id);
    return {
      ...a,
      name: nameBy.get(a.id) ?? a.email ?? "(no name yet)",
      years: yearsOfExperience(parsed),
      skills: parsed?.skills ?? [],
      score: (ai?.score as number | null) ?? null,
      rank: (ai?.rank as number | null) ?? null,
      recommendation: (ai?.recommendation as string | null) ?? null,
      hrScore: (hr?.hr_score as number | null) ?? null,
      hrDecision: (hr?.hr_decision as string | null) ?? null,
      interviewScore: interviewBy.get(a.id) ?? null,
      haystack: [a.email, a.phone, ...(textBy.get(a.id) ?? []), parsed ? JSON.stringify(parsed) : ""]
        .join(" ")
        .toLowerCase(),
      answers: answersBy.get(a.id) ?? new Map(),
    };
  });

  return {
    job,
    rows,
    questions: questionList.map((q) => ({
      id: q.id as string,
      label: q.label as string,
      type: q.type as string,
      is_salary: Boolean(q.is_salary),
    })) as QuestionCol[],
  };
}

export function applyFilters(rows: CandidateRow[], f: Filters): CandidateRow[] {
  const out = rows.filter((r) => {
    if (f.view === "incomplete" && r.status !== "incomplete") return false;
    if (f.status && r.status !== f.status) return false;
    if (f.dup === "yes" && !r.is_duplicate) return false;
    if (f.dup === "no" && r.is_duplicate) return false;
    if (f.q && !r.haystack.includes(f.q)) return false;
    if (f.skill && !r.skills.some((s) => s.toLowerCase().includes(f.skill))) return false;
    if (!inDateRange(r.created_at, f.from, f.to)) return false;
    if (f.minYears && (r.years ?? 0) < f.minYears) return false;
    return true;
  });
  if (f.sort === "score") out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return out;
}
