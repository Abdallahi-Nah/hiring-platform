import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { LocalTime } from "@/components/ui/LocalTime";
import { PublicShell } from "@/components/ui/PublicShell";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { roomWindow } from "@/lib/live-interview";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";
import { MeetRoom } from "./MeetRoom";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

// Serveurs de relais optionnels (TURN) : le STUN gratuit de Google suffit sur la plupart des réseaux.
// Les identifiants TURN ne sortent du serveur que pour une personne qui a un lien valide.
function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const urls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  if (urls.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    list.push({ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  }
  return list;
}

type Job = { title: string; companies: { name: string; logo_path: string | null } | null } | null;

// Salle d'entretien en direct. Un RH connecté de l'entreprise (RLS) entre comme "hôte" ; toute autre personne avec le lien secret entre comme "candidat".
export default async function MeetPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { t, locale } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  if (!(await rateLimit("meet-page", 300, 3600))) {
    return (
      <PublicShell title={t("live.room.title")}>
        <p className="card text-center">{t("common.tooMany")}</p>
      </PublicShell>
    );
  }

  const supabase = await createClient();
  const { data: mine } = await supabase.from("live_interviews").select("id").eq("token", token).maybeSingle();
  const role: "host" | "guest" = mine ? "host" : "guest";

  const db = createAdminClient();
  const { data: lv } = await db
    .from("live_interviews")
    .select("id, status, scheduled_at, duration_minutes, applications(id, track_token, job_forms(title, companies(name, logo_path)))")
    .eq("token", token)
    .single();
  if (!lv) notFound();
  const app = lv.applications as unknown as { id: string; track_token: string; job_forms: Job } | null;
  const job = app?.job_forms ?? null;
  const tag = formatLocale(locale);
  const back = role === "host" ? `/admin/candidates/${app?.id}` : `/track/${app?.track_token}`;

  const head = (
    <div className="card grid gap-1">
      <h2 className="sub-title" dir="auto">{job?.title}</h2>
      {job?.companies && (
        <p className="flex items-center gap-2 text-sm font-semibold text-primary" dir="auto">
          <CompanyLogo path={job.companies.logo_path} size={24} />
          {job.companies.name}
        </p>
      )}
    </div>
  );
  const notice = (text: string, extra?: React.ReactNode) => (
    <PublicShell title={t("live.room.title")}>
      <div className="stack">
        {head}
        <div className="card grid gap-3">
          <p role="status">{text}</p>
          {extra}
          <div><Link href={back} className="btn">{t("live.room.back")}</Link></div>
        </div>
      </div>
    </PublicShell>
  );

  if (lv.status === "cancelled") return notice(t("live.room.cancelled"));
  if (lv.status === "ended") return notice(t("live.room.ended"));
  const win = roomWindow(lv.scheduled_at);
  if (win === "expired") return notice(t("live.room.expired"));
  if (win === "early") {
    return notice(t("live.room.early"), <p className="font-semibold"><LocalTime iso={lv.scheduled_at} localeTag={tag} /></p>);
  }

  return (
    <PublicShell title={t("live.room.title")} wide>
      <div className="mx-auto grid max-w-5xl gap-4">
        {head}
        <MeetRoom
          token={token}
          role={role}
          liveId={lv.id}
          iceServers={iceServers()}
          peerName={role === "host" ? t("live.room.candidate") : (job?.companies?.name ?? t("track.team"))}
          backHref={back}
        />
      </div>
    </PublicShell>
  );
}
