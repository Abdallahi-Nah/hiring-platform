import { after, NextResponse } from "next/server";
import { addNotification } from "@/lib/notifications";
import { roomWindow } from "@/lib/live-interview";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";

// Le candidat est entré dans la salle : on note l'heure et on prévient l'équipe (une seule fois).
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) return NextResponse.json({ ok: false }, { status: 404 });
  if (!(await rateLimit("meet-joined", 60, 3600))) return NextResponse.json({ ok: false }, { status: 429 });

  const db = createAdminClient();
  const { data: lv } = await db.from("live_interviews").select("id, application_id, status, scheduled_at, guest_joined_at").eq("token", token).single();
  if (!lv || !["scheduled", "in_progress"].includes(lv.status) || roomWindow(lv.scheduled_at) !== "open") return NextResponse.json({ ok: false }, { status: 403 });
  if (lv.guest_joined_at) return NextResponse.json({ ok: true });

  const { data: updated } = await db
    .from("live_interviews")
    .update({ guest_joined_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", lv.id)
    .is("guest_joined_at", null)
    .select("id");
  if (updated?.length) after(() => addNotification(lv.application_id, "live"));
  return NextResponse.json({ ok: true });
}
