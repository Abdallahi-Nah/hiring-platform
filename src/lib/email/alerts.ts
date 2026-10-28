import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import { getPublicJobs, type PublicJob } from "@/lib/public-jobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale } from "./templated";
import { escapeHtml, sendMail } from "./transport";

type Alert = {
  id: string;
  user_id: string;
  query: string | null;
  location: string | null;
  employment_type: string | null;
  work_mode: string | null;
  min_salary: number | null;
  locale: string;
  last_sent_at: string | null;
  created_at: string;
};

export function matches(job: PublicJob, a: Pick<Alert, "query" | "location" | "employment_type" | "work_mode" | "min_salary">) {
  const hay = `${job.title} ${job.description ?? ""} ${job.department ?? ""} ${job.company?.name ?? ""}`.toLowerCase();
  if (a.query && !a.query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  if (a.location && !(job.location ?? "").toLowerCase().includes(a.location.toLowerCase())) return false;
  if (a.employment_type && job.employment_type !== a.employment_type) return false;
  if (a.work_mode && job.work_mode !== a.work_mode) return false;
  if (a.min_salary != null && (job.salary_max ?? job.salary_min ?? -1) < a.min_salary) return false;
  return true;
}

const MAX_ALERTS = 500;
const MAX_JOBS_PER_EMAIL = 10;

// Un email par alerte quand de nouvelles offres (publiées après le dernier envoi) correspondent.
export async function sendJobAlerts(baseUrl: string) {
  const db = createAdminClient();
  const [jobs, { data: alerts }] = await Promise.all([
    getPublicJobs(),
    db.from("job_alerts").select("*").order("created_at").limit(MAX_ALERTS),
  ]);
  let sent = 0;
  for (const a of (alerts ?? []) as Alert[]) {
    try {
      const since = a.last_sent_at ?? a.created_at;
      const found = jobs.filter((j) => (j.created_at ?? "") > since && matches(j, a)).slice(0, MAX_JOBS_PER_EMAIL);
      if (found.length === 0) continue;
      const email = (await db.auth.admin.getUserById(a.user_id)).data.user?.email;
      if (!email) continue;
      const locale: Locale = isLocale(a.locale) ? a.locale : "en";
      const t = makeT(locale);
      const dir = isRtl(locale) ? "rtl" : "ltr";
      const items = found.map((j) => ({ title: j.title, company: j.company?.name ?? "", link: `${baseUrl}/jobs/${j.id}` }));
      const manage = `${baseUrl}/me/alerts`;
      const text = [t("email2.alertIntro"), "", ...items.map((i) => `- ${i.title} (${i.company}): ${i.link}`), "", `${t("email2.alertManage")}: ${manage}`].join("\n");
      const html = `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}"><h2>${escapeHtml(t("email2.alertIntro"))}</h2><ul>${items
        .map((i) => `<li><a href="${escapeHtml(i.link)}">${escapeHtml(i.title)}</a> — ${escapeHtml(i.company)}</li>`)
        .join("")}</ul><p style="color:#555"><a href="${escapeHtml(manage)}">${escapeHtml(t("email2.alertManage"))}</a></p></div>`;
      await sendMail({ to: email, subject: t("email2.alertSubject", { n: items.length }), text, html });
      await db.from("job_alerts").update({ last_sent_at: new Date().toISOString() }).eq("id", a.id);
      sent++;
    } catch (e) {
      console.error("sendJobAlerts", a.id, e);
    }
  }
  return sent;
}
