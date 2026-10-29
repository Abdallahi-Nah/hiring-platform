import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { LocalTime } from "@/components/ui/LocalTime";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { LiveActions, ScheduleForm } from "./LiveInterviewControls";

const TONE = { scheduled: "info", in_progress: "good", ended: "neutral", cancelled: "bad" } as const;

// Section "Entretien en direct" de la fiche candidat : rendez-vous, lien privé et accès à la salle.
export async function LiveInterviewSection({ applicationId, applicationStatus, canManage, localeTag }: { applicationId: string; applicationStatus: string; canManage: boolean; localeTag: string }) {
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: lv } = await supabase
    .from("live_interviews")
    .select("id, token, status, scheduled_at, duration_minutes, guest_joined_at")
    .eq("application_id", applicationId)
    .maybeSingle();

  const header = (
    <div>
      <h2 className="sub-title">{t("live.hr.title")}</h2>
      <p className="hint mt-1">{t("live.hr.hint")}</p>
    </div>
  );
  const canSchedule = canManage && applicationStatus !== "incomplete";

  if (!lv) {
    return (
      <section className="card grid gap-4" aria-labelledby="live-h">
        <div id="live-h">{header}</div>
        {canSchedule ? <ScheduleForm applicationId={applicationId} /> : <p className="hint">{t("live.hr.none")}</p>}
      </section>
    );
  }

  const active = lv.status === "scheduled" || lv.status === "in_progress";
  const link = `${await siteUrl()}/meet/${lv.token}`;
  return (
    <section className="card grid gap-4" aria-labelledby="live-h">
      <div id="live-h">{header}</div>
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={TONE[lv.status as keyof typeof TONE] ?? "neutral"}>{t(`live.hr.status.${lv.status}` as "live.hr.status.scheduled")}</Chip>
          <span className="font-semibold"><LocalTime iso={lv.scheduled_at} localeTag={localeTag} /></span>
          <span className="hint">{t("live.hr.minutes", { n: lv.duration_minutes })}</span>
        </div>
        {lv.guest_joined_at && <p className="hint">{t("live.hr.guestJoined")}</p>}
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/meet/${lv.token}`} className="btn btn-primary">{t("live.hr.join")}</Link>
          <span className="hint">{t("live.hr.joinHint")}</span>
        </div>
      )}
      {active && <LiveActions liveId={lv.id} link={link} canManage={canManage} />}
      {canSchedule && <ScheduleForm applicationId={applicationId} existing={{ scheduledAt: lv.scheduled_at, minutes: lv.duration_minutes, active }} />}
    </section>
  );
}
