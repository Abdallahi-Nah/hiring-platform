import Link from "next/link";
import { connection } from "next/server";
import { Chip } from "@/components/ui/Chip";
import { DateRange } from "@/components/ui/DateRange";
import { Pagination } from "@/components/ui/Pagination";
import { inDateRange, paginate, validDate } from "@/lib/paginate";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { IconSearch } from "@/components/ui/icons";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const PAGE_SIZE = 10;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // rendu à chaque demande (session et heure)
  const user = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q").trim().toLowerCase();
  const state = get("state"); // "active" | "inactive" | ""
  const from = validDate(get("from"));
  const to = validDate(get("to"));
  const canEdit = user.role !== "reviewer";
  const supabase = await createClient();

  const [{ data: all }, { data: apps }] = await Promise.all([
    supabase.from("job_forms").select("id, title, reference, is_active, created_at").order("created_at", { ascending: false }),
    supabase.from("applications").select("job_form_id").neq("status", "incomplete").limit(5000),
  ]);
  const counts = new Map<string, number>();
  for (const a of apps ?? []) counts.set(a.job_form_id, (counts.get(a.job_form_id) ?? 0) + 1);

  const matching = (all ?? []).filter((j) => {
    if (!inDateRange(j.created_at, from, to)) return false;
    if (state === "active" && !j.is_active) return false;
    if (state === "inactive" && j.is_active) return false;
    if (q && !`${j.title} ${j.reference ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const { items: jobs, page, pages, total } = paginate(matching, get("page"), PAGE_SIZE);
  const keep = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v !== "")
  ) as Record<string, string>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="title">{t("admin.jobs.title")}</h1>
          <p className="hint mt-1">{t("admin.jobs.subtitle")}</p>
        </div>
        {canEdit && (
          <Link href="/admin/jobs/new" className="btn btn-primary">
            {t("admin.jobs.newJob")}
          </Link>
        )}
      </div>

      <LiveSearch
        className="flex flex-wrap items-center gap-2.5"
        resultsClassName="grid gap-3"
        fields={
          <>
            <div className="relative min-w-60 flex-[1_1_260px]">
              <span className="pointer-events-none absolute start-3 top-3 text-muted"><IconSearch /></span>
              <input name="q" defaultValue={get("q")} placeholder={t("admin.jobs.searchPlaceholder")} aria-label={t("admin.jobs.searchLabel")} autoComplete="off" className="field !ps-10" />
            </div>
            <select name="state" defaultValue={state} aria-label={t("admin.jobs.stateLabel")} className="field !w-auto">
              <option value="">{t("admin.jobs.all")}</option>
              <option value="active">{t("admin.jobs.activeOnly")}</option>
              <option value="inactive">{t("admin.jobs.inactiveOnly")}</option>
            </select>
            <DateRange from={from} to={to} />
          </>
        }
      >
        {jobs.length === 0 && (
          <div className="card grid justify-items-center gap-2 py-10 text-center">
            <b>{(all ?? []).length === 0 ? t("admin.jobs.noneYet") : t("admin.jobs.noneMatch")}</b>
            <p className="hint">
              {(all ?? []).length === 0 ? t("admin.jobs.createFirst") : t("admin.jobs.tryOther")}
            </p>
          </div>
        )}

        {jobs.map((j) => (
          <div key={j.id} className="card flex flex-wrap items-center gap-4 !p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/admin/jobs/${j.id}/candidates`} className="text-base font-semibold hover:underline">
                {j.title}
              </Link>
              <div className="hint mt-0.5">
                {j.reference ? `${j.reference} · ` : ""}
                {t("admin.jobs.applications", { n: counts.get(j.id) ?? 0 })}
              </div>
            </div>
            <Chip tone={j.is_active ? "good" : "neutral"}>{j.is_active ? t("admin.jobs.active") : t("admin.jobs.inactive")}</Chip>
            <div className="flex gap-2">
              <Link href={`/admin/jobs/${j.id}/candidates`} className="btn btn-primary">
                {t("admin.jobs.candidates")}
              </Link>
              {canEdit && (
                <Link href={`/admin/jobs/${j.id}`} className="btn btn-orange">
                  {t("admin.jobs.editForm")}
                </Link>
              )}
            </div>
          </div>
        ))}
        {total > 0 && <p className="hint text-center">{t("common.resultsCount", { n: total })}</p>}
        <Pagination basePath="/admin/jobs" params={keep} page={page} pages={pages} />
      </LiveSearch>
    </div>
  );
}
