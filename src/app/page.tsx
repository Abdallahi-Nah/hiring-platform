import Link from "next/link";
import { redirect } from "next/navigation";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { connection } from "next/server";
import { JobChips } from "@/components/ui/JobChips";
import { DateRange } from "@/components/ui/DateRange";
import { Pagination } from "@/components/ui/Pagination";
import { inDateRange, paginate, validDate } from "@/lib/paginate";
import { SaveButton } from "@/components/ui/SaveButton";
import { getCandidate } from "@/lib/candidate-auth";
import { createClient } from "@/lib/supabase/server";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { PublicShell } from "@/components/ui/PublicShell";
import { IconSearch } from "@/components/ui/icons";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/jobs/schema";
import { getPublicJobs } from "@/lib/public-jobs";
import { rateLimit } from "@/lib/rate-limit";

export const instant = false;

const PAGE_SIZE = 12;

const excerpt = (s: string | null, n = 160) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
};
const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("meta.openJobs") };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { t } = await getI18n();
  const sp = await searchParams;
  // Retour de Google : si Supabase renvoie le code sur l'accueil (adresse de retour non listée dans Supabase), on le traite.
  if (typeof sp.code === "string" && /^[\w-]{10,100}$/.test(sp.code)) redirect(`/auth/confirm?code=${encodeURIComponent(sp.code)}&next=/me`);
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const q = get("q");
  const mode = get("mode");
  const type = get("type");
  const dept = get("dept");
  const loc = get("loc");
  const company = get("company");
  const sort = get("sort");
  const from = validDate(get("from"));
  const to = validDate(get("to"));
  const salary = Math.max(0, Number(get("salary")) || 0);

  if (!(await rateLimit("jobs-list", 600, 3600))) {
    return (
      <PublicShell title={t("meta.openJobs")} showStaffLink wide>
        <p className="card text-center">{t("common.tooMany")}</p>
      </PublicShell>
    );
  }

  const all = await getPublicJobs();
  const me = await getCandidate();
  const savedIds = new Set<string>(
    me ? ((await (await createClient()).from("saved_jobs").select("job_form_id")).data ?? []).map((r) => r.job_form_id) : []
  );
  const departments = distinct(all.map((j) => j.department));
  const locations = distinct(all.map((j) => j.location));
  const companies = [...new Map(all.map((j) => [j.company!.slug, j.company!.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const needle = q.toLowerCase();
  const matching = all
    .filter((j) => {
      if (!inDateRange(j.created_at ?? "", from, to)) return false;
      if (needle && !`${j.title} ${j.description ?? ""} ${j.department ?? ""} ${j.location ?? ""} ${j.company?.name ?? ""}`.toLowerCase().includes(needle)) return false;
      if (company && j.company?.slug !== company) return false;
      if (mode && j.work_mode !== mode) return false;
      if (type && j.employment_type !== type) return false;
      if (dept && j.department?.toLowerCase() !== dept.toLowerCase()) return false;
      if (loc && j.location?.toLowerCase() !== loc.toLowerCase()) return false;
      if (salary && (j.salary_max ?? j.salary_min ?? -1) < salary) return false;
      return true;
    })
    .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : 0));

  const { items: jobs, page, pages } = paginate(matching, get("page"), PAGE_SIZE);
  const keep = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v !== "")
  ) as Record<string, string>;
  const filtered = !!(q || company || mode || type || dept || loc || from || to || salary);

  return (
    <PublicShell
      title={t("home.title")}
      subtitle={t("home.subtitle")}
      showStaffLink
      wide
    >
      <div className="grid gap-4">
        <LiveSearch
          className="card flex flex-wrap items-center gap-2.5 !p-3"
          resultsClassName="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          fields={
            <>
              <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[1_1_340px]">
                <span className="pointer-events-none absolute start-3 top-3 text-muted">
                  <IconSearch />
                </span>
                <input name="q" defaultValue={q} placeholder={t("home.searchPlaceholder")} aria-label={t("home.searchLabel")} autoComplete="off" className="field !ps-10" />
              </div>
              {companies.length > 1 && (
                <select name="company" defaultValue={company} aria-label={t("home.companyLabel")} className="field filter-select">
                  <option value="">{t("home.anyCompany")}</option>
                  {companies.map(([slug, name]) => (
                    <option key={slug} value={slug}>{name}</option>
                  ))}
                </select>
              )}
              <select name="type" defaultValue={type} aria-label={t("home.contractLabel")} className="field filter-select">
                <option value="">{t("home.anyContract")}</option>
                {EMPLOYMENT_TYPES.map((c) => (
                  <option key={c} value={c}>{t(`jobs.employment.${c}` as MessageKey)}</option>
                ))}
              </select>
              <select name="mode" defaultValue={mode} aria-label={t("home.modeLabel")} className="field filter-select">
                <option value="">{t("home.anyMode")}</option>
                {WORK_MODES.map((m) => (
                  <option key={m} value={m}>{t(`jobs.workMode.${m}` as MessageKey)}</option>
                ))}
              </select>
              {departments.length > 0 && (
                <select name="dept" defaultValue={dept} aria-label={t("home.departmentLabel")} className="field filter-select">
                  <option value="">{t("home.anyDepartment")}</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
              {locations.length > 0 && (
                <select name="loc" defaultValue={loc} aria-label={t("home.locationLabel")} className="field filter-select">
                  <option value="">{t("home.anyLocation")}</option>
                  {locations.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              )}
              <select name="sort" defaultValue={sort} aria-label={t("home.sortLabel")} className="field filter-select">
                <option value="">{t("home.newest")}</option>
                <option value="title">{t("home.titleAz")}</option>
              </select>
              <input name="salary" type="number" min={0} defaultValue={salary || ""} placeholder={t("home.minSalary")} aria-label={t("home.minSalary")} className="field filter-select" />
              <DateRange from={from} to={to} />
            </>
          }
        >
          <p className="hint col-span-full" role="status">
            {t(filtered ? "home.countFiltered" : "home.count", { n: matching.length })}
          </p>

          {jobs.length === 0 && (
            <div className="card col-span-full grid justify-items-center gap-2 py-10 text-center">
              <b>{filtered ? t("home.noMatch") : t("home.noOpen")}</b>
              <p className="hint">{filtered ? t("home.tryOther") : t("home.checkLater")}</p>
            </div>
          )}

          {jobs.map((j) => (
            <article key={j.id} className="card flex h-full flex-col gap-3 !p-5">
              <div>
                <h2 className="sub-title text-xl" dir="auto">
                  <Link href={`/jobs/${j.id}`} className="hover:underline">
                    {j.title}
                  </Link>
                </h2>
                {j.company && (
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary" dir="auto">
                    <CompanyLogo path={j.company.logo} size={24} />
                    {j.company.name}
                  </p>
                )}
              </div>
              <JobChips job={j} />
              {j.description && <p className="line-clamp-3 text-muted" dir="auto">{excerpt(j.description, 220)}</p>}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <Link href={`/jobs/${j.id}`} className="btn btn-primary">
                  {t("home.viewApply")}
                </Link>
                <SaveButton jobId={j.id} saved={savedIds.has(j.id)} />
              </div>
            </article>
          ))}
          <Pagination basePath="/" params={keep} page={page} pages={pages} className="col-span-full" />
        </LiveSearch>
      </div>
    </PublicShell>
  );
}
