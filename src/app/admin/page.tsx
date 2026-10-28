import { connection } from "next/server";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { requireUser } from "@/lib/auth";
import { formatLocale } from "@/i18n/config";
import { statusLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { STATUS_TONE } from "@/lib/candidates";
import { DailyChart, type Day } from "./DailyChart";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

function buildDays(perDay: Map<string, number>, locale: string): Day[] {
  return Array.from({ length: 30 }, (_, i) => {
    const date = daysAgo(29 - i);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      label: date.toLocaleDateString(formatLocale(locale as Parameters<typeof formatLocale>[0]), { day: "numeric", month: "short", timeZone: "UTC" }),
      count: perDay.get(key) ?? 0,
    };
  });
}

export default async function AdminHome() {
  await connection(); // rendu à chaque demande (session et heure)
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [{ count: activeJobs }, { count: total }, { count: toReview }, { count: shortlisted }, { data: recent }, { data: recentDates }, { count: reached }, { count: interviewed }, { count: hired }, { data: viewRows }, { data: jobRows }, { data: hireRows }] =
    await Promise.all([
      supabase.from("job_forms").select("id", head).eq("is_active", true),
      supabase.from("applications").select("id", head).neq("status", "incomplete"),
      supabase.from("applications").select("id", head).eq("status", "submitted"),
      supabase.from("applications").select("id", head).eq("status", "shortlisted"),
      supabase
        .from("applications")
        .select("id, email, status, created_at, job_forms(title)")
        .neq("status", "incomplete")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("applications")
        .select("submitted_at, job_form_id")
        .neq("status", "incomplete")
        .gte("submitted_at", daysAgo(30).toISOString())
        .limit(5000),
      supabase.from("applications").select("id", head).in("status", ["shortlisted", "interviewed", "evaluated", "final_recommendation_ready"]),
      supabase.from("applications").select("id", head).in("status", ["interviewed", "evaluated", "final_recommendation_ready"]),
      supabase.from("hr_evaluations").select("application_id", head).eq("hr_decision", "hire"),
      supabase.from("job_views").select("job_form_id").gte("viewed_at", daysAgo(30).toISOString()).limit(20000),
      supabase.from("job_forms").select("id, title").order("created_at", { ascending: false }).limit(200),
      supabase.from("hr_evaluations").select("updated_at, applications(submitted_at)").eq("hr_decision", "hire").limit(1000),
    ]);

  // Candidatures par jour (30 derniers jours, jours en UTC)
  const perDay = new Map<string, number>();
  for (const r of recentDates ?? []) {
    const d = (r.submitted_at ?? "").slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const days = buildDays(perDay, locale);

  // Vues, candidatures et conversion par offre (30 derniers jours)
  const viewsBy = new Map<string, number>();
  for (const v of viewRows ?? []) viewsBy.set(v.job_form_id, (viewsBy.get(v.job_form_id) ?? 0) + 1);
  const appsBy = new Map<string, number>();
  for (const r of recentDates ?? []) appsBy.set(r.job_form_id, (appsBy.get(r.job_form_id) ?? 0) + 1);
  const perJob = (jobRows ?? [])
    .map((j) => ({ id: j.id, title: j.title, views: viewsBy.get(j.id) ?? 0, apps: appsBy.get(j.id) ?? 0 }))
    .filter((j) => j.views > 0 || j.apps > 0)
    .sort((a, b) => b.views - a.views || b.apps - a.apps)
    .slice(0, 8);
  const totalViews = (viewRows ?? []).length;
  const totalApps30 = (recentDates ?? []).length;
  const conversion = totalViews > 0 ? Math.min(100, Math.round((totalApps30 / totalViews) * 100)) : null;
  // Délai moyen de recrutement : de l'envoi de la candidature à la décision "Hire" (en jours).
  const spans = (hireRows ?? [])
    .map((h) => {
      const sent = (h.applications as unknown as { submitted_at: string | null } | null)?.submitted_at;
      return sent ? (new Date(h.updated_at).getTime() - new Date(sent).getTime()) / 86400000 : null;
    })
    .filter((d): d is number => d != null && d >= 0);
  const avgHire = spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : null;

  const funnel = [
    { label: t("admin.dashboard.funnelReceived"), value: total ?? 0 },
    { label: t("admin.dashboard.funnelShortlisted"), value: reached ?? 0 },
    { label: t("admin.dashboard.funnelInterview"), value: interviewed ?? 0 },
    { label: t("admin.dashboard.funnelHired"), value: hired ?? 0 },
  ];
  const funnelMax = Math.max(1, funnel[0].value);

  const stats = [
    { label: t("admin.dashboard.activeJobs"), value: activeJobs ?? 0 },
    { label: t("admin.dashboard.received"), value: total ?? 0 },
    { label: t("admin.dashboard.toReview"), value: toReview ?? 0 },
    { label: t("admin.dashboard.shortlisted"), value: shortlisted ?? 0 },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="title">{user.fullName ? t("admin.dashboard.helloName", { name: user.fullName }) : t("admin.dashboard.hello")}</h1>
        <p className="hint mt-1">{t("admin.dashboard.subtitle")}</p>
      </div>

      <div className="stats !my-0">
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="stats !my-0">
        {[
          { label: t("hr1.stats.views"), value: totalViews },
          { label: t("hr1.stats.conversion"), value: conversion != null ? `${conversion}%` : "—" },
          { label: t("hr1.stats.timeToHire"), value: avgHire != null ? t("hr1.stats.days", { n: avgHire }) : "—" },
        ].map((s) => (
          <div key={s.label} className="card stat">
            <b>{s.value}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card grid gap-3">
          <h2 className="sub-title">{t("admin.dashboard.perDay")}</h2>
          <DailyChart days={days} />
        </section>
        <section className="card grid gap-3">
          <div>
            <h2 className="sub-title">{t("admin.dashboard.funnel")}</h2>
            <p className="hint mt-1">{t("admin.dashboard.funnelHint")}</p>
          </div>
          <ul className="grid gap-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{f.label}</span>
                  <b>{f.value}</b>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(f.value ? 3 : 0, (f.value / funnelMax) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {perJob.length > 0 && (
        <section className="card grid gap-3">
          <div>
            <h2 className="sub-title">{t("hr1.stats.perJob")}</h2>
            <p className="hint mt-1">{t("hr1.stats.perJobHint")}</p>
          </div>
          <div className="table-wrap overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("admin.jobs.title")}</th>
                  <th>{t("hr1.stats.views")}</th>
                  <th>{t("admin.dashboard.received")}</th>
                  <th>{t("hr1.stats.conversion")}</th>
                </tr>
              </thead>
              <tbody>
                {perJob.map((j) => (
                  <tr key={j.id}>
                    <td><Link href={`/admin/jobs/${j.id}/candidates`} className="font-semibold hover:underline" dir="auto">{j.title}</Link></td>
                    <td>{j.views}</td>
                    <td>{j.apps}</td>
                    <td>{j.views > 0 ? `${Math.min(100, Math.round((j.apps / j.views) * 100))}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card grid gap-3">
        <div className="flex items-center">
          <h2 className="sub-title flex-1">{t("admin.dashboard.latest")}</h2>
          <Link href="/admin/jobs" className="btn">
            {t("admin.dashboard.allJobs")}
          </Link>
        </div>
        {(recent ?? []).length === 0 && <p className="hint">{t("admin.dashboard.none")}</p>}
        <ul className="divide-y divide-line">
          {recent?.map((a) => {
            const job = a.job_forms as unknown as { title: string } | null;
            return (
              <li key={a.id}>
                <Link href={`/admin/candidates/${a.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                  <Avatar name={a.email ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{a.email ?? t("admin.dashboard.noEmail")}</b>
                    <span className="hint">
                      {job?.title} · {new Date(a.created_at).toLocaleDateString(formatLocale(locale))}
                    </span>
                  </div>
                  <Chip tone={STATUS_TONE[a.status] ?? "neutral"}>{statusLabel(t, a.status)}</Chip>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
