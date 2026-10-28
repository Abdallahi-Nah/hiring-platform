import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale } from "./templated";
import { escapeHtml, oneLine, sendMail } from "./transport";

// Invitation à l'entretien vidéo : le lien privé contient le jeton de l'entretien. Lance une erreur si l'envoi échoue.
export async function sendInterviewInvite(interviewId: string, baseUrl: string) {
  const db = createAdminClient();
  const { data: iv } = await db
    .from("ai_interviews")
    .select("token, expires_at, locale, questions, applications(email, job_forms(title, companies(name)))")
    .eq("id", interviewId)
    .single();
  const app = iv?.applications as unknown as { email: string | null; job_forms: { title: string; companies: { name: string } | null } | null } | null;
  if (!iv || !app?.email) throw new Error("no candidate email");
  const locale: Locale = isLocale(iv.locale) ? iv.locale : "en";
  const t = makeT(locale);
  const company = oneLine(app.job_forms?.companies?.name ?? "");
  const job = oneLine(app.job_forms?.title ?? t("email.fallbackJob"));
  const count = Array.isArray(iv.questions) ? iv.questions.length : 0;
  const expires = new Date(iv.expires_at ?? Date.now()).toLocaleDateString(locale === "ar" ? "ar" : locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long" });
  const vars = { company, job, count, date: expires };
  const link = `${baseUrl}/interview/${iv.token}`;
  const subject = t("ivid.email.subject", vars);
  const lines = [t("ivid.email.intro", vars), t("ivid.email.how", vars), t("ivid.email.expires", vars)];
  const dir = isRtl(locale) ? "rtl" : "ltr";
  await sendMail({
    to: app.email,
    fromName: company,
    subject,
    text: `${lines.join("\n\n")}\n\n${link}`,
    html: `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}">${lines
      .map((l) => `<p>${escapeHtml(l)}</p>`)
      .join("")}<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#00b141;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t("ivid.email.button"))}</a></p></div>`,
  });
}
