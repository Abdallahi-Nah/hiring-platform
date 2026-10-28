import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { PublicShell } from "@/components/ui/PublicShell";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { rateLimit } from "@/lib/rate-limit";
import { computeStage, STEPS } from "@/lib/track-stage";
import { UUID } from "@/lib/uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrackChat } from "./TrackChat";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

const isPast = (d?: string | null) => !!d && new Date(d) < new Date();

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { t, locale } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  if (!(await rateLimit("track", 300, 3600))) {
    return (
      <PublicShell title={t("track.title")}>
        <p className="card text-center">{t("common.tooMany")}</p>
      </PublicShell>
    );
  }

  const db = createAdminClient();
  const { data: app } = await db
    .from("applications")
    .select("id, status, viewed_at, submitted_at, decision_email_sent_at, job_forms(title, companies(name, logo_path))")
    .eq("track_token", token)
    .single();
  if (!app || app.status === "incomplete") notFound();

  const [{ data: hr }, { count: interviews }, { data: messages }, { data: aiIv }] = await Promise.all([
    db.from("hr_evaluations").select("hr_decision").eq("application_id", app.id).maybeSingle(),
    db.from("interviews").select("id", { count: "exact", head: true }).eq("application_id", app.id),
    db.from("messages").select("id, sender, sender_name, body, created_at, delivered_at, read_at").eq("application_id", app.id).order("created_at").limit(200),
    db.from("ai_interviews").select("token, status, expires_at, questions").eq("application_id", app.id).in("status", ["invited", "in_progress"]).maybeSingle(),
  ]);
  const job = app.job_forms as unknown as { title: string; companies: { name: string; logo_path: string | null } | null } | null;

  const { outcome, reached } = computeStage({
    status: app.status,
    viewed_at: app.viewed_at,
    decision_email_sent_at: app.decision_email_sent_at,
    hr_decision: hr?.hr_decision ?? null,
    interviews: interviews ?? 0,
  });
  const fmt = (d: string) => new Date(d).toLocaleString(formatLocale(locale), { dateStyle: "medium", timeStyle: "short" });

  return (
    <PublicShell title={t("track.title")} subtitle={t("track.subtitle")}>
      <div className="stack">
        <div className="card grid gap-1">
          <h2 className="sub-title" dir="auto">{job?.title}</h2>
          {job?.companies && (
            <p className="flex items-center gap-2 text-sm font-semibold text-primary" dir="auto">
              <CompanyLogo path={job.companies.logo_path} size={24} />
              {job.companies.name}
            </p>
          )}
          {app.submitted_at && <p className="hint">{t("track.sentOn", { date: fmt(app.submitted_at) })}</p>}
        </div>

        {aiIv && !isPast(aiIv.expires_at) && (
          <section className="card grid gap-2" aria-labelledby="aiiv-h">
            <h2 id="aiiv-h" className="sub-title">{t("ivid.track.title")}</h2>
            <p className="text-sm">{t("ivid.track.text", { company: job?.companies?.name ?? t("track.team"), count: Array.isArray(aiIv.questions) ? aiIv.questions.length : 0 })}</p>
            {aiIv.expires_at && <p className="hint">{t("ivid.track.until", { date: new Date(aiIv.expires_at).toLocaleDateString(formatLocale(locale), { dateStyle: "long" }) })}</p>}
            <div><Link href={`/interview/${aiIv.token}`} className="btn btn-primary">{t("ivid.track.button")}</Link></div>
          </section>
        )}

        <section className="card grid gap-3" aria-labelledby="steps-h">
          <h2 id="steps-h" className="sub-title">{t("track.status")}</h2>
          <ol className="grid gap-3">
            {STEPS.map((s) => {
              const done = reached[s];
              const label = s === "decision" ? (outcome ? t(`track.step.${outcome}` as MessageKey) : t("track.step.decision")) : t(`track.step.${s}` as MessageKey);
              const tone = s === "decision" && outcome === "rejected" ? "text-bad" : done ? "text-good" : "text-muted";
              return (
                <li key={s} className={`flex items-center gap-3 font-semibold ${tone}`} aria-current={done ? "step" : undefined}>
                  <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full border-2 border-current text-sm">{done ? "✓" : ""}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card grid gap-4" aria-labelledby="chat-h">
          <h2 id="chat-h" className="sub-title">{t("hr1.chat.title")}</h2>
          <TrackChat
            token={token}
            initial={(messages ?? []).map((m) => ({ id: m.id, sender: m.sender, sender_name: m.sender_name, body: m.body, created_at: m.created_at, delivered_at: m.delivered_at, read_at: m.read_at }))}
            localeTag={formatLocale(locale)}
            hrName={job?.companies?.name ?? t("track.team")}
          />
        </section>
      </div>
    </PublicShell>
  );
}
