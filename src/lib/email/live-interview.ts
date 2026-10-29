import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale } from "./templated";
import { escapeHtml, oneLine, sendMail } from "./transport";

// Invitation à l'entretien en direct : le lien privé contient le jeton de la salle. Lance une erreur si l'envoi échoue.
export async function sendLiveInvite(liveId: string, baseUrl: string) {
  const db = createAdminClient();
  const { data: lv } = await db
    .from("live_interviews")
    .select("token, scheduled_at, duration_minutes, locale, applications(email, job_forms(title, companies(name)))")
    .eq("id", liveId)
    .single();
  const app = lv?.applications as unknown as { email: string | null; job_forms: { title: string; companies: { name: string } | null } | null } | null;
  if (!lv || !app?.email) throw new Error("no candidate email");
  const locale: Locale = isLocale(lv.locale) ? lv.locale : "en";
  const t = makeT(locale);
  const company = oneLine(app.job_forms?.companies?.name ?? "");
  const job = oneLine(app.job_forms?.title ?? t("email.fallbackJob"));
  const tag = locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en-GB";
  // Le serveur ne connaît pas le fuseau du candidat : l'email donne l'heure en UTC, la page du lien l'affiche à l'heure locale.
  const when = new Date(lv.scheduled_at).toLocaleString(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
  const vars = { company, job, date: when, minutes: lv.duration_minutes };
  const link = `${baseUrl}/meet/${lv.token}`;
  const subject = t("live.email.subject", vars);
  const lines = [t("live.email.intro", vars), t("live.email.when", vars), t("live.email.how", vars)];
  const dir = isRtl(locale) ? "rtl" : "ltr";
  await sendMail({
    to: app.email,
    fromName: company,
    subject,
    text: `${lines.join("\n\n")}\n\n${link}`,
    html: `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}">${lines
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("")}<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#00b141;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t("live.email.button"))}</a></p></div>`,
  });
}
