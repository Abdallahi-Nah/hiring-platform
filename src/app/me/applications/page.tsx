import Link from "next/link";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { Chip } from "@/components/ui/Chip";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { requireCandidate } from "@/lib/candidate-auth";
import { computeStage } from "@/lib/track-stage";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type Row = {
  id: string;
  status: string;
  viewed_at: string | null;
  submitted_at: string | null;
  decision_email_sent_at: string | null;
  track_token: string;
  job_forms: { title: string; companies: { name: string; logo_path: string | null } | null } | null;
};

export default async function MyApplicationsPage() {
  await connection();
  const me = await requireCandidate("/me/applications");
  const { t, locale } = await getI18n();
  // Les candidatures ne sont pas lisibles par le public : lecture par le serveur, limitée à ce compte.
  const db = createAdminClient();
  const { data } = await db
    .from("applications")
    .select("id, status, viewed_at, submitted_at, decision_email_sent_at, track_token, job_forms(title, companies(name, logo_path))")
    .eq("candidate_id", me.id)
    .neq("status", "incomplete")
    .order("submitted_at", { ascending: false })
    .limit(100);
  const apps = (data ?? []) as unknown as Row[];
  const ids = apps.map((a) => a.id);
  const [{ data: hrs }, { data: ivs }] = ids.length
    ? await Promise.all([
        db.from("hr_evaluations").select("application_id, hr_decision").in("application_id", ids),
        db.from("interviews").select("application_id").in("application_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const decision = new Map((hrs ?? []).map((h) => [h.application_id, h.hr_decision as string | null]));
  const interviews = new Map<string, number>();
  for (const i of ivs ?? []) interviews.set(i.application_id, (interviews.get(i.application_id) ?? 0) + 1);

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="title">{t("cand.applications.title")}</h1>
        <p className="hint mt-1">{t("cand.applications.subtitle")}</p>
      </div>
      {apps.length === 0 && (
        <div className="card grid justify-items-center gap-3 py-10 text-center">
          <b>{t("cand.applications.none")}</b>
          <Link href="/" className="btn btn-primary">{t("cand.applications.browse")}</Link>
        </div>
      )}
      {apps.map((a) => {
        const stage = computeStage({
          status: a.status,
          viewed_at: a.viewed_at,
          decision_email_sent_at: a.decision_email_sent_at,
          hr_decision: decision.get(a.id) ?? null,
          interviews: interviews.get(a.id) ?? 0,
        });
        const label = stage.current === "decision" && stage.outcome ? stage.outcome : stage.current;
        const tone = stage.outcome === "accepted" ? "good" : stage.outcome === "rejected" ? "bad" : stage.current === "sent" ? "neutral" : "info";
        return (
          <article key={a.id} className="card flex flex-wrap items-center gap-4 !p-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold" dir="auto">{a.job_forms?.title}</h2>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-muted" dir="auto">
                <CompanyLogo path={a.job_forms?.companies?.logo_path} size={20} />
                {a.job_forms?.companies?.name}
                {a.submitted_at && <span>· {new Date(a.submitted_at).toLocaleDateString(formatLocale(locale))}</span>}
              </p>
            </div>
            <Chip tone={tone}>{t(`track.step.${label}` as MessageKey)}</Chip>
            <Link href={`/track/${a.track_token}`} className="btn">{t("cand.applications.open")}</Link>
          </article>
        );
      })}
    </div>
  );
}
