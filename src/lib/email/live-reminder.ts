import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale } from "./templated";
import { escapeHtml, oneLine, sendMail } from "./transport";

const AHEAD_MINUTES = 65; // le rappel part dès que l'entretien est à moins de 65 minutes

type Row = {
  id: string;
  token: string;
  scheduled_at: string;
  invited_at: string | null;
  locale: string;
  applications: { email: string | null; job_forms: { title: string; companies: { name: string } | null } | null } | null;
};

// Envoie le rappel au candidat pour les entretiens qui commencent bientôt. Appelée toutes les 10 minutes par un service de tâches planifiées.
export async function sendLiveReminders(baseUrl: string): Promise<number> {
  const db = createAdminClient();
  const now = Date.now();
  const { data } = await db
    .from("live_interviews")
    .select("id, token, scheduled_at, invited_at, locale, applications(email, job_forms(title, companies(name)))")
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .gt("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + AHEAD_MINUTES * 60_000).toISOString());

  let sent = 0;
  for (const lv of (data ?? []) as unknown as Row[]) {
    const mark = () => db.from("live_interviews").update({ reminder_sent_at: new Date().toISOString() }).eq("id", lv.id);
    // Invitation envoyée il y a moins d'une heure : le rappel serait un doublon.
    if (lv.invited_at && new Date(lv.scheduled_at).getTime() - new Date(lv.invited_at).getTime() <= AHEAD_MINUTES * 60_000) {
      await mark();
      continue;
    }
    const email = lv.applications?.email;
    if (!email) continue;
    try {
      const locale: Locale = isLocale(lv.locale) ? lv.locale : "en";
      const t = makeT(locale);
      const company = oneLine(lv.applications?.job_forms?.companies?.name ?? "");
      const job = oneLine(lv.applications?.job_forms?.title ?? t("email.fallbackJob"));
      const tag = locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en-GB";
      const date = new Date(lv.scheduled_at).toLocaleString(tag, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
      const vars = { company, job, date };
      const lines = [t("live.remind.intro", vars), t("live.remind.how", vars)];
      const link = `${baseUrl}/meet/${lv.token}`;
      const dir = isRtl(locale) ? "rtl" : "ltr";
      await sendMail({
        to: email,
        fromName: company,
        subject: t("live.remind.subject", vars),
        text: `${lines.join("\n\n")}\n\n${link}`,
        html: `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}">${lines
          .map((l) => `<p>${escapeHtml(l)}</p>`)
          .join("")}<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#00b141;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t("live.email.button"))}</a></p></div>`,
      });
      await mark();
      sent++;
    } catch (e) {
      console.error("sendLiveReminders", lv.id, e);
    }
  }
  return sent;
}
