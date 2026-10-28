import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, oneLine, sendMail } from "./transport";

// Adresses des Super Admin et Admin d'une entreprise.
export async function staffEmails(companyId: string): Promise<string[]> {
  const db = createAdminClient();
  const { data: staff } = await db.from("profiles").select("id").eq("company_id", companyId).in("role", ["super_admin", "admin"]);
  return (await Promise.all((staff ?? []).map((p) => db.auth.admin.getUserById(p.id))))
    .map((r) => r.data.user?.email)
    .filter((e): e is string => !!e);
}

// Prévient les Super Admin et Admin qu'une candidature vient d'être envoyée (sans salaire ni score).
// Les emails RH sont en anglais : un compte RH n'a pas de langue choisie.
export async function notifyNewApplication(applicationId: string, baseUrl: string) {
  try {
    const db = createAdminClient();
    const { data: app } = await db
      .from("applications")
      .select("job_form_id, job_forms(title, company_id, companies(name))")
      .eq("id", applicationId)
      .single();
    if (!app) return;

    const { data: nameAnswer } = await db
      .from("answers")
      .select("value, questions!inner(config)")
      .eq("application_id", applicationId)
      .eq("questions.config->>identity", "name")
      .maybeSingle();
    const name = oneLine(String(nameAnswer?.value ?? "")) || "A candidate";

    const jobInfo = app.job_forms as unknown as { title: string; company_id: string; companies: { name: string } | null } | null;
    if (!jobInfo) return;
    // Seulement les RH de l'entreprise qui a publié l'offre.
    const emails = await staffEmails(jobInfo.company_id);
    if (emails.length === 0) return;

    const job = oneLine(jobInfo.title ?? "a job");
    const link = `${baseUrl}/admin/candidates/${applicationId}`;
    await sendMail({
      to: emails,
      fromName: jobInfo.companies?.name,
      subject: `New application: ${name} - ${job}`.slice(0, 200),
      text: `${name} applied for ${job}.\n\nOpen the application: ${link}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>New application</h2><p><strong>${escapeHtml(name)}</strong> applied for <strong>${escapeHtml(job)}</strong>.</p><p><a href="${escapeHtml(link)}">Open the application</a></p></div>`,
    });
  } catch (e) {
    console.error("notifyNewApplication", applicationId, e);
  }
}
