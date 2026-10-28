import Link from "next/link";
import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { IconSearch } from "@/components/ui/icons";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { Pagination } from "@/components/ui/Pagination";
import { ScoreBar } from "@/components/ui/Score";
import { statusLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { STATUS_TONE, answerText, yearsOfExperience, type ParsedResume } from "@/lib/candidates";
import { paginate } from "@/lib/paginate";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const PAGE_SIZE = 15;
const MAX_CVS = 2000;

type ResumeRow = {
  application_id: string;
  parsed_data: ParsedResume | null;
  applications: { id: string; status: string; email: string | null; job_form_id: string; job_forms: { title: string } | null };
};

// Recherche dans tous les CV analysés de l'entreprise (les règles RLS limitent déjà aux candidatures de l'entreprise).
export default async function CvSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : "");
  const words = get("q").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const skill = get("skill").toLowerCase();
  const minYears = Math.max(0, Number(get("min_years")) || 0);
  const job = get("job");
  const searching = !!(words.length || skill || minYears || job);

  const supabase = await createClient();
  const [{ data: jobs }, { data: rows }] = await Promise.all([
    supabase.from("job_forms").select("id, title").order("created_at", { ascending: false }).limit(200),
    searching
      ? supabase
          .from("resumes")
          .select("application_id, parsed_data, applications!inner(id, status, email, job_form_id, job_forms(title))")
          .not("parsed_data", "is", null)
          .neq("applications.status", "incomplete")
          .limit(MAX_CVS)
      : Promise.resolve({ data: [] }),
  ]);

  const matches = ((rows ?? []) as unknown as ResumeRow[])
    .map((r) => ({ r, years: yearsOfExperience(r.parsed_data), hay: `${r.applications.email ?? ""} ${JSON.stringify(r.parsed_data)}`.toLowerCase() }))
    .filter(({ r, years, hay }) => {
      if (job && r.applications.job_form_id !== job) return false;
      if (words.some((w) => !hay.includes(w))) return false;
      if (skill && !(r.parsed_data?.skills ?? []).concat(r.parsed_data?.tools ?? []).some((s) => s.toLowerCase().includes(skill))) return false;
      if (minYears && (years ?? 0) < minYears) return false;
      return true;
    });

  const { items, page, pages, total } = paginate(matches, get("page"), PAGE_SIZE);
  const ids = items.map((m) => m.r.application_id);

  // Nom, score IA : seulement pour la page affichée.
  const [{ data: names }, { data: evals }] = ids.length
    ? await Promise.all([
        supabase.from("answers").select("application_id, value, questions!inner(config)").in("application_id", ids).eq("questions.config->>identity", "name"),
        supabase.from("ai_evaluations").select("application_id, score").in("application_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const nameBy = new Map((names ?? []).map((n) => [n.application_id, answerText(n.value)]));
  const scoreBy = new Map((evals ?? []).map((e) => [e.application_id, e.score as number | null]));
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v !== "")) as Record<string, string>;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="title">{t("hr1.search.title")}</h1>
        <p className="hint mt-1">{t("hr1.search.subtitle")}</p>
      </div>

      <LiveSearch
        className="flex flex-wrap items-center gap-2.5"
        resultsClassName="grid gap-3"
        fields={
          <>
            <div className="relative min-w-60 flex-[1_1_260px]">
              <span className="pointer-events-none absolute start-3 top-3 text-muted"><IconSearch /></span>
              <input name="q" defaultValue={get("q")} placeholder={t("hr1.search.placeholder")} aria-label={t("hr1.search.label")} autoComplete="off" className="field !ps-10" />
            </div>
            <input name="skill" defaultValue={get("skill")} placeholder={t("admin.candidates.skill")} aria-label={t("admin.candidates.skill")} className="field !w-40" />
            <input name="min_years" type="number" min={0} defaultValue={get("min_years")} placeholder={t("admin.candidates.minYears")} aria-label={t("admin.candidates.minYears")} className="field !w-36" />
            <select name="job" defaultValue={job} aria-label={t("hr1.search.job")} className="field !w-auto max-w-56">
              <option value="">{t("hr1.search.anyJob")}</option>
              {(jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </>
        }
      >
        {!searching && <p className="card text-center hint">{t("hr1.search.start")}</p>}
        {searching && items.length === 0 && (
          <div className="card grid justify-items-center gap-2 py-10 text-center">
            <b>{t("hr1.search.none")}</b>
            <p className="hint">{t("admin.jobs.tryOther")}</p>
          </div>
        )}
        {items.map(({ r, years }) => {
          const a = r.applications;
          const name = nameBy.get(r.application_id) || a.email || "—";
          const skills = (r.parsed_data?.skills ?? []).slice(0, 8);
          return (
            <Link key={r.application_id} href={`/admin/candidates/${r.application_id}`} className="card grid gap-2 !p-4 hover:border-primary">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate" dir="auto">{name}</b>
                  <span className="hint" dir="auto">{a.job_forms?.title}{years != null ? ` · ${t("admin.candidates.yrs", { n: years })}` : ""}</span>
                </div>
                <Chip tone={STATUS_TONE[a.status] ?? "neutral"}>{statusLabel(t, a.status)}</Chip>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <Chip key={s} tone="neutral">{s}</Chip>
                  ))}
                </div>
              )}
              {scoreBy.get(r.application_id) != null && <ScoreBar value={scoreBy.get(r.application_id) ?? null} />}
            </Link>
          );
        })}
        {searching && total > 0 && <p className="hint text-center">{t("common.resultsCount", { n: total })}</p>}
        <Pagination basePath="/admin/search" params={keep} page={page} pages={pages} />
      </LiveSearch>
    </div>
  );
}
