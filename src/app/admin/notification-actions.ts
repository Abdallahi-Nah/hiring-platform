"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Marque toutes les notifications comme lues pour l'utilisateur connecté.
export async function markNotificationsSeen(): Promise<void> {
  const user = await requireUser();
  await createAdminClient().from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", user.id);
}
