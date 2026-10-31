"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { ackConversation } from "./messages/actions";

type Toast = { id: string; kind: string; applicationId: string | null };

// WebSocket Supabase Realtime pour toute l'équipe : cloche, badge "Messages" et listes se mettent à jour
// sans recharger la page, et une petite alerte s'affiche à chaque nouvelle notification.
// Les règles RLS s'appliquent : l'entreprise ne reçoit que ses propres lignes.
export function LiveSync() {
  const t = useT();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };
    let wasDown = false;
    const ch = supabase
      .channel("staff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
        // Un message du candidat est "reçu" dès que l'équipe est connectée, même hors de la conversation.
        const m = p.new as { sender?: string; application_id?: string };
        if (p.eventType === "INSERT" && m.sender === "candidate" && m.application_id) void ackConversation(m.application_id, "delivered");
        refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
        const n = p.new as { id: string; kind: string; application_id: string | null };
        setToast({ id: n.id, kind: n.kind, applicationId: n.application_id });
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setToast(null), 6000);
        refresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && wasDown) refresh();
        if (status !== "SUBSCRIBED") wasDown = true;
      });
    return () => {
      clearTimeout(refreshTimer.current);
      clearTimeout(hideTimer.current);
      supabase.removeChannel(ch);
    };
  }, [router]);

  if (!toast) return null;
  const isMessage = toast.kind === "message";
  const href = isMessage && toast.applicationId ? `/admin/messages?c=${toast.applicationId}` : toast.applicationId ? `/admin/candidates/${toast.applicationId}` : "/admin";
  return (
    <div className="card fixed bottom-4 end-4 z-40 flex max-w-xs items-center gap-3 !p-3 shadow-lg" role="status">
      <Link href={href} onClick={() => setToast(null)} className="flex-1 text-sm font-semibold">
        {t(isMessage ? "rt.toast.message" : toast.kind === "interview" ? "ivid.toast" : toast.kind === "live" ? "live.toast" : "rt.toast.application")}
      </Link>
      <button type="button" className="btn !p-1.5" aria-label={t("rt.toast.close")} onClick={() => setToast(null)}>×</button>
    </div>
  );
}
