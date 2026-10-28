"use server";

import { requireUser } from "@/lib/auth";
import { broadcastReceipt } from "@/lib/realtime";
import { UUID } from "@/lib/uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Accusé de réception des messages du candidat : "delivered" = reçu par l'équipe, "read" = conversation vue.
// Les règles RLS limitent à l'entreprise ; le candidat est prévenu en direct. Retourne le nombre de messages changés.
export async function ackConversation(applicationId: string, level: "delivered" | "read"): Promise<number> {
  await requireUser();
  if (!UUID.test(applicationId) || (level !== "delivered" && level !== "read")) return 0;
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("track_token").eq("id", applicationId).single();
  if (!app) return 0;
  const at = new Date().toISOString();

  const delivered = await supabase
    .from("messages")
    .update({ delivered_at: at })
    .eq("application_id", applicationId)
    .eq("sender", "candidate")
    .is("delivered_at", null)
    .select("id");
  let ids = (delivered.data ?? []).map((r) => r.id);
  if (level === "read") {
    const read = await supabase
      .from("messages")
      .update({ read_at: at })
      .eq("application_id", applicationId)
      .eq("sender", "candidate")
      .is("read_at", null)
      .select("id");
    ids = (read.data ?? []).map((r) => r.id);
    // Message lu : sa notification disparaît de la cloche (l'accès à la candidature est déjà vérifié par RLS ci-dessus).
    await createAdminClient().from("notifications").delete().eq("application_id", applicationId).eq("kind", "message");
  }
  if (ids.length > 0) await broadcastReceipt(app.track_token, { ids, level, at });
  return level === "read" ? Math.max(ids.length, 1) : ids.length;
}
