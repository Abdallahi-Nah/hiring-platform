import { createAdminClient } from "@/lib/supabase/admin";

// Ajoute une ligne dans la cloche de l'entreprise (nouvelle candidature ou nouveau message).
export async function addNotification(applicationId: string, kind: "application" | "message" | "interview" | "live") {
  try {
    const db = createAdminClient();
    const { data: app } = await db.from("applications").select("job_forms(company_id)").eq("id", applicationId).single();
    const companyId = (app?.job_forms as unknown as { company_id: string } | null)?.company_id;
    if (!companyId) return;
    await db.from("notifications").insert({ company_id: companyId, kind, application_id: applicationId });
  } catch (e) {
    console.error("addNotification", applicationId, e);
  }
}
