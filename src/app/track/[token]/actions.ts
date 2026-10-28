"use server";

import { after } from "next/server";
import { getI18n } from "@/i18n/server";
import { notifyHrMessage } from "@/lib/email/message";
import { addNotification } from "@/lib/notifications";
import type { LiveMessage } from "@/lib/realtime";
import { rateLimit } from "@/lib/rate-limit";
import { UUID } from "@/lib/uuid";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

// Le candidat écrit à l'équipe RH depuis son lien secret.
export async function sendCandidateMessage(token: string, body: string): Promise<{ ok?: boolean; error?: string; message?: LiveMessage }> {
  const { t } = await getI18n();
  const text = body.trim();
  if (!UUID.test(token) || !text || text.length > 2000) return { error: t("hr1.chat.errLength") };
  if (!(await rateLimit("track-msg", 20, 3600))) return { error: t("common.tooMany") };

  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id, status").eq("track_token", token).single();
  if (!app || app.status === "incomplete") return { error: t("hr1.chat.errSend") };
  const { data: row, error } = await db
    .from("messages")
    .insert({ application_id: app.id, sender: "candidate", body: text })
    .select("id, sender, sender_name, body, created_at, delivered_at, read_at")
    .single();
  if (error || !row) return { error: t("hr1.chat.errSend") };

  const baseUrl = await siteUrl();
  after(() => notifyHrMessage(app.id, baseUrl));
  after(() => addNotification(app.id, "message"));
  return { ok: true, message: row };
}

// Accusé de réception des messages de l'équipe : "delivered" = page ouverte, "read" = page vue.
// L'équipe RH le voit en direct (✓✓). Retourne le nombre de messages changés.
export async function ackHrMessages(token: string, level: "delivered" | "read"): Promise<number> {
  if (!UUID.test(token) || (level !== "delivered" && level !== "read")) return 0;
  if (!(await rateLimit("track-ack", 200, 3600))) return 0;
  const db = createAdminClient();
  const { data: app } = await db.from("applications").select("id").eq("track_token", token).single();
  if (!app) return 0;
  const at = new Date().toISOString();
  const delivered = await db
    .from("messages")
    .update({ delivered_at: at })
    .eq("application_id", app.id)
    .eq("sender", "hr")
    .is("delivered_at", null)
    .select("id");
  let n = (delivered.data ?? []).length;
  if (level === "read") {
    const read = await db.from("messages").update({ read_at: at }).eq("application_id", app.id).eq("sender", "hr").is("read_at", null).select("id");
    n = (read.data ?? []).length;
  }
  return n;
}
