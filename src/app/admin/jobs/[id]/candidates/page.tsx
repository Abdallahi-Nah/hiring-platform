import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { IconDownload, IconSearch } from "@/components/ui/icons";
import { DateRange } from "@/components/ui/DateRange";
import { Pagination } from "@/components/ui/Pagination";
import { paginate } from "@/lib/paginate";
import { KanbanBoard } from "./KanbanBoard";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { ScoreBar } from "@/components/ui/Score";
import { requireUser } from "@/lib/auth";
import { applyFilters, loadCandidates, parseFilters } from "@/lib/candidate-list";
import { formatLocale } from "@/i18n/config";
import { recommendationLabel, statusLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { RECOMMENDATION_TONE, STATUS_LABELS, STATUS_TONE } from "@/lib/candidates";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const PAGE_SIZE = 20;

export default async function CandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Cette page utilise l'heure actuelle (années d'expérience, liens signés) : rendu à chaque demande.
  await connection();
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const dateFmt = (d: string) => new Date(d).toLocaleDateString(formatLocale(locale));
  const { id } = await params;
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = parseFilters(get);

  const data = await loadCandidates(await createClient(), id);
  if (!data) notFound();

  const { job, rows: all } = data;
  const filtered = applyFilters(all, filters);
  const { items: rows, page, pages, total } = paginate(filtered, get("page"), PAGE_SIZE);
  const keep = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => k !== "page" && typeof v === "string" && v !== "")
  ) as Record<string, string>;
  const submitted = all.filter((a) => a.status !== "incomplete");
  const incompleteCount = all.length - submitted.length;
  const scored = all.filter((a) => a.score != null);
  const avg = scored.length ? Math.round(scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length) : null;
  const { view, status, dup, sort } = filters;
  const board = get("layout") === "board";
  const boardRows = filtered.filter((r) => r.status !== "incomplete").slice(0, 300);
  const keepLayout = board ? "?layout=board" : "";

  const stats = [
    { label: t("admin.candidates.applications"), value: all.length },
    { label: t("admin.candidates.submitted"), value: submitted.length },
    { label: t("admin.candidates.shortlisted"), value: all.filter((a) => a.status === "shortlisted").length },
    { label: t("admin.candidates.avgScore"), value: avg != null ? `${avg}%` : "—" },
  ];

  return (
    <div className="grid gap-5">
      <div>
        <Link href="/admin/jobs" className="hint hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {t("admin.jobs.title")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="title flex-1" dir="auto">{job.title}</h1>
          {user.role !== "reviewer" && (
            <Link href={`/admin/jobs/${id}`} className="btn btn-orange hide-m">
              {t("admin.jobs.editForm")}
            </Link>
          )}
        </div>
      </div>

      <div className="stats !my-0">
        {stats.map((s) => (
          <div key={s.label} className="card stat !p-4">
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
      <div className="tabs w-fit">
        <Link href={`/admin/jobs/${id}/candidates${keepLayout}`} className={view ? "" : "on"}>
          {t("admin.candidates.tabAll", { n: all.length })}
        </Link>
        <Link href={`/admin/jobs/${id}/candidates?view=incomplete${board ? "&layout=board" : ""}`} className={view === "incomplete" ? "on" : ""}>
          {t("admin.candidates.tabIncomplete", { n: incompleteCount })}
        </Link>
      </div>
      <div className="tabs w-fit">
        <Link href={`/admin/jobs/${id}/candidates${view ? `?view=${view}` : ""}`} className={board ? "" : "on"}>
          {t("hr1.kanban.list")}
        </Link>
        <Link href={`/admin/jobs/${id}/candidates?layout=board${view ? `&view=${view}` : ""}`} className={board ? "on" : ""}>
          {t("hr1.kanban.board")}
        </Link>
      </div>
      </div>

      <LiveSearch
        key={view || "all"}
        className="flex flex-wrap items-center gap-2.5"
        resultsClassName="grid gap-5"
        fields={
          <>

            {view && <input type="hidden" name="view" value={view} />}
            {board && <input type="hidden" name="layout" value="board" />}
            <div className="relative min-w-60 flex-[1_1_260px]">
              <span className="pointer-events-none absolute start-3 top-3 text-muted"><IconSearch /></span>
              <input name="q" defaultValue={get("q")} placeholder={t("admin.candidates.searchPlaceholder")} aria-label={t("admin.candidates.searchLabel")} className="field !ps-10" />
            </div>
            <select name="status" defaultValue={status} aria-label={t("admin.candidates.statusLabel")} className="field !w-auto">
              <option value="">{t("admin.candidates.statusAny")}</option>
              {Object.keys(STATUS_LABELS).map((v) => (
                <option key={v} value={v}>{statusLabel(t, v)}</option>
              ))}
            </select>
            <select name="sort" defaultValue={sort} aria-label={t("admin.candidates.sortLabel")} className="field !w-auto">
              <option value="">{t("admin.candidates.newest")}</option>
              <option value="score">{t("admin.candidates.bestScore")}</option>
            </select>
            <DateRange from={filters.from} to={filters.to} />
            <details className="relative">
              <summary className="btn list-none">{t("admin.candidates.moreFilters")}</summary>
              <div className="card absolute end-0 z-10 mt-2 grid w-72 gap-3">
                <div>
                  <label htmlFor="dup" className="label">{t("admin.candidates.duplicates")}</label>
                  <select id="dup" name="dup" defaultValue={dup} className="field">
                    <option value="">{t("admin.candidates.any")}</option>
                    <option value="yes">{t("admin.candidates.duplicatesOnly")}</option>
                    <option value="no">{t("admin.candidates.noDuplicates")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="skill" className="label">{t("admin.candidates.skill")}</label>
                  <input id="skill" name="skill" defaultValue={get("skill")} className="field" />
                </div>
                <div>
                  <label htmlFor="min_years" className="label">{t("admin.candidates.minYears")}</label>
                  <input id="min_years" name="min_years" type="number" min={0} defaultValue={get("min_years")} className="field" />
                </div>
              </div>
            </details>
                </>
        }
      >
      <details className="card !p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <IconDownload /> {t("admin.candidates.export")}
        </summary>
        <form action={`/api/admin/jobs/${id}/export`} method="get" className="mt-4 flex flex-wrap items-end gap-3">
          {/* Les filtres actuels sont envoyés pour l'export "Filtered subset". */}
          {(["q", "status", "dup", "skill", "min_years", "view", "sort", "from", "to"] as const).map(
            (k) => get(k) && <input key={k} type="hidden" name={k} value={get(k)} />
          )}
          <div>
            <label htmlFor="scope" className="label">{t("admin.candidates.exportContent")}</label>
            <select id="scope" name="scope" defaultValue="filtered" className="field">
              <option value="full">{t("admin.candidates.scopeFull")}</option>
              <option value="filtered">{t("admin.candidates.scopeFiltered")}</option>
              <option value="summary">{t("admin.candidates.scopeSummary")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="format" className="label">{t("admin.candidates.format")}</label>
            <select id="format" name="format" defaultValue="xlsx" className="field">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <button className="btn btn-primary">{t("admin.candidates.download")}</button>
        </form>
      </details>

      {board ? (
        <>
          <KanbanBoard key={boardRows.map((r) => r.id + r.status).join(",")} cards={boardRows.map((r) => ({ id: r.id, name: r.name, score: r.score, rank: r.rank, status: r.status }))} />
          {filtered.length > boardRows.length && <p className="hint text-center">{t("hr1.kanban.capped", { n: boardRows.length })}</p>}
        </>
      ) : (
      <>
      <div className="card table-wrap overflow-x-auto !p-0">
        <table className="table">
          <thead>
            <tr>
              <th>{t("admin.candidates.candidate")}</th>
              <th>{t("admin.candidates.statusLabel")}</th>
              <th className="hide-t">{t("admin.candidates.years")}</th>
              <th>{t("admin.candidates.aiScore")}</th>
              <th>{t("admin.candidates.rank")}</th>
              <th>{t("admin.candidates.aiSuggests")}</th>
              <th className="hide-t">{t("admin.candidates.applied")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="!py-10 text-center text-muted">{t("admin.candidates.none")}</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/candidates/${r.id}`} className="flex items-center gap-3">
                    <Avatar name={r.name} />
                    <span>
                      <b className="block">
                        {r.name} {r.is_duplicate && <Chip tone="neutral">{t("admin.candidates.duplicate")}</Chip>}
                      </b>
                      <span className="hint">{r.email ?? "—"}</span>
                    </span>
                  </Link>
                </td>
                <td><Chip tone={STATUS_TONE[r.status] ?? "neutral"}>{statusLabel(t, r.status)}</Chip></td>
                <td className="hide-t">{r.years ?? "—"}</td>
                <td><ScoreBar value={r.score} /></td>
                <td>{r.rank != null ? <b>#{r.rank}</b> : "—"}</td>
                <td>
                  {r.recommendation ? (
                    <Chip tone={RECOMMENDATION_TONE[r.recommendation] ?? "neutral"}>
                      {recommendationLabel(t, r.recommendation)}
                    </Chip>
                  ) : "—"}
                </td>
                <td className="hide-t text-muted">{dateFmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cards-m">
          {rows.length === 0 && <p className="card text-center text-muted">{t("admin.candidates.none")}</p>}
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/candidates/${r.id}`} className="cand">
              <div className="flex items-center gap-3">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate">{r.name}</b>
                  <span className="hint">{r.years != null ? `${t("admin.candidates.yrs", { n: r.years })} · ` : ""}{dateFmt(r.created_at)}</span>
                </div>
                <Chip tone={STATUS_TONE[r.status] ?? "neutral"}>{statusLabel(t, r.status)}</Chip>
              </div>
              {r.score != null && <ScoreBar value={r.score} />}
              <div className="flex flex-wrap gap-2">
                {r.rank != null && <Chip tone="neutral">{t("admin.candidates.rankN", { n: r.rank })}</Chip>}
                {r.is_duplicate && <Chip tone="neutral">{t("admin.candidates.duplicate")}</Chip>}
                {r.recommendation && (
                  <Chip tone={RECOMMENDATION_TONE[r.recommendation] ?? "neutral"}>
                    {recommendationLabel(t, r.recommendation)}
                  </Chip>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <p className="hint text-center">{t("common.resultsCount", { n: total })}</p>
      <Pagination basePath={`/admin/jobs/${id}/candidates`} params={keep} page={page} pages={pages} />
      </>
      )}
      </LiveSearch>
    </div>
  );
}
