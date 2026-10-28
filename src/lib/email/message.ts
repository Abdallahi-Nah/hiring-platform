import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffEmails } from "./notify-hr";
import { isLocale } from "./templated";
import { escapeHtml, oneLine, sendMail } from "./transport";

// Prévient le candidat qu'il a un nouveau message (le texte n'est pas dans l'email : il lit sur son lien secret).
export async function notifyCandidateMessage(applicationId: string, baseUrl: string) {
  try {
    const { data: app } = await createAdminClient()
      .from("applications")
      .select("email, locale, track_token, job_forms(title, companies(name))")
      .eq("id", applicationId)
      .single();
    if (!app?.email) return;
    const info = app.job_forms as unknown as { title: string; companies: { name: string } | null } | null;
    const locale: Locale = isLocale(app.locale ?? "") ? (app.locale as Locale) : "en";
    const t = makeT(locale);
    const vars = { company: oneLine(info?.companies?.name ?? ""), job: oneLine(info?.title ?? t("email.fallbackJob")) };
    const link = `${baseUrl}/track/${app.track_token}`;
    const subject = t("email1.msgSubject", vars);
    const intro = t("email1.msgBody", vars);
    const dir = isRtl(locale) ? "rtl" : "ltr";
    await sendMail({
      to: app.email,
      fromName: info?.companies?.name,
      subject,
      text: `${intro}\n\n${link}`,
      html: `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}"><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(link)}">${escapeHtml(t("email1.msgLink"))}</a></p></div>`,
    });
  } catch (e) {
    console.error("notifyCandidateMessage", applicationId, e);
  }
}

// Prévient les RH (en anglais, comme les autres emails RH) qu'un candidat a répondu.
export async function notifyHrMessage(applicationId: string, baseUrl: string) {
  try {
    const { data: app } = await createAdminClient()
      .from("applications")
      .select("email, job_forms(title, company_id, companies(name))")
      .eq("id", applicationId)
      .single();
    const info = app?.job_forms as unknown as { title: string; company_id: string; companies: { name: string } | null } | null;
    if (!app || !info) return;
    const emails = await staffEmails(info.company_id);
    if (emails.length === 0) return;
    const job = oneLine(info.title);
    const link = `${baseUrl}/admin/candidates/${applicationId}`;
    await sendMail({
      to: emails,
      fromName: info.companies?.name,
      subject: `New message from a candidate - ${job}`.slice(0, 200),
      text: `A candidate wrote a message about ${job}.\n\nOpen the application: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>New message</h2><p>A candidate wrote a message about <strong>${escapeHtml(job)}</strong>.</p><p><a href="${escapeHtml(link)}">Open the application</a></p></div>`,
    });
  } catch (e) {
    console.error("notifyHrMessage", applicationId, e);
  }
}
