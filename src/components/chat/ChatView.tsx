"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { trackChannel, type LiveMessage, type Receipt } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import { Ticks, type TickState } from "./Ticks";

type SendResult = { ok?: boolean; error?: string; message?: LiveMessage };

// Chat en direct (WebSocket Supabase Realtime), partagé par l'équipe RH et le candidat.
// - RH : reçoit les messages du candidat par "postgres_changes" (protégé par RLS).
// - Candidat : reçoit les messages de l'équipe par le canal secret "track:<jeton>".
// - Les deux côtés échangent l'indicateur "écrit..." sur ce même canal.
export function ChatView({
  me,
  token,
  appId,
  initial,
  send,
  localeTag,
  hrName,
  canWrite,
  ack,
  extra,
}: {
  me: "hr" | "candidate";
  token: string;
  appId: string;
  initial: LiveMessage[];
  send: (text: string) => Promise<SendResult>;
  localeTag: string;
  hrName: string;
  canWrite: boolean;
  ack: (level: "delivered" | "read") => void | Promise<unknown>;
  extra?: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [live, setLive] = useState<LiveMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [online, setOnline] = useState(true);
  const [typing, setTyping] = useState(false);
  const [pending, start] = useTransition();
  const list = useRef<HTMLUListElement>(null);
  const channel = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const lastTyping = useRef(0);
  const [receipts, setReceipts] = useState<Record<string, { d?: string | null; r?: string | null }>>({});
  const ackRef = useRef(ack);
  useEffect(() => {
    ackRef.current = ack;
  });

  const messages = useMemo(() => {
    const byId = new Map<string, LiveMessage>();
    for (const m of [...initial, ...live]) byId.set(m.id, m);
    return [...byId.values()]
      .map((m) => {
        const r = receipts[m.id];
        return r ? { ...m, delivered_at: r.d ?? m.delivered_at, read_at: r.r ?? m.read_at } : m;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [initial, live, receipts]);

  // Reçu = la page est ouverte ; lu = la page est affichée à l'écran. Se refait quand l'onglet revient au premier plan.
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const run = () => void ackRef.current(visible() ? "read" : "delivered");
    run();
    const onShow = () => visible() && void ackRef.current("read");
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    let wasDown = false;
    const add = (m: LiveMessage) => {
      if (!m?.id || typeof m.body !== "string") return;
      setLive((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.sender !== me) void ackRef.current(document.visibilityState === "visible" ? "read" : "delivered");
      setTyping(false);
    };

    const ch = supabase.channel(trackChannel(token));
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.from === me) return;
      setTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setTyping(false), 3000);
    });
    if (me === "candidate") {
      ch.on("broadcast", { event: "msg" }, ({ payload }) => add(payload as LiveMessage));
      ch.on("broadcast", { event: "receipt" }, ({ payload }) => {
        const r = payload as Receipt;
        if (!Array.isArray(r?.ids)) return;
        setReceipts((prev) => {
          const next = { ...prev };
          for (const id of r.ids) next[id] = { d: r.at, r: r.level === "read" ? r.at : prev[id]?.r };
          return next;
        });
      });
    }
    ch.subscribe((status) => {
      const ok = status === "SUBSCRIBED";
      setOnline(ok);
      if (ok && wasDown) router.refresh();
      if (!ok) wasDown = true;
    });
    channel.current = ch;

    const db =
      me === "hr"
        ? supabase
            .channel(`msg:${appId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `application_id=eq.${appId}` }, (p) => {
              const m = p.new as LiveMessage & { sender: string };
              if (m.sender === "candidate") add(m);
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `application_id=eq.${appId}` }, (p) => {
              const m = p.new as LiveMessage;
              setReceipts((prev) => ({ ...prev, [m.id]: { d: m.delivered_at, r: m.read_at } }));
            })
            .subscribe()
        : null;

    return () => {
      clearTimeout(typingTimer);
      channel.current = null;
      supabase.removeChannel(ch);
      if (db) supabase.removeChannel(db);
    };
  }, [me, token, appId, router]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  function onType(v: string) {
    setText(v);
    const now = Date.now();
    if (now - lastTyping.current > 2000) {
      lastTyping.current = now;
      void channel.current?.send({ type: "broadcast", event: "typing", payload: { from: me } });
    }
  }

  function submit() {
    if (pending || !text.trim()) return;
    start(async () => {
      const res = await send(text);
      setError(res.error ?? "");
      if (res.ok && res.message) {
        const m = res.message;
        setLive((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        setText("");
      }
    });
  }

  const tick = (m: LiveMessage): TickState => (m.read_at ? "read" : m.delivered_at ? "delivered" : "sent");
  const fmt = (d: string) => new Date(d).toLocaleString(localeTag, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="grid min-h-0 gap-3">
      <p className="hint flex items-center gap-2" role="status">
        <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${online ? "bg-good" : "bg-bad"}`} />
        {online ? t("rt.live") : t("rt.reconnecting")}
      </p>
      <ul ref={list} className="grid max-h-[55vh] min-h-40 content-start gap-2 overflow-y-auto pe-1" aria-live="polite">
        {messages.length === 0 && <li className="hint">{t("hr1.chat.empty")}</li>}
        {messages.map((m) => {
          const mine = m.sender === me;
          const who = m.sender === "hr" ? (m.sender_name ?? hrName) : me === "candidate" ? t("track.you") : t("hr1.chat.candidate");
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl border px-3 py-2 ${mine ? "ms-auto border-transparent bg-good-soft" : "me-auto border-line bg-surface-2"}`}>
              <p className="whitespace-pre-wrap break-words" dir="auto">{m.body}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted" suppressHydrationWarning>
                <span>{mine ? t("track.you") : who} · {fmt(m.created_at)}</span>
                {mine && <Ticks state={tick(m)} />}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="hint h-4" aria-live="polite">{typing ? t("rt.typing") : ""}</p>
      {canWrite && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="chat-msg" className="label">{t("hr1.chat.write")}</label>
          <textarea
            id="chat-msg"
            rows={2}
            maxLength={2000}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="field"
            dir="auto"
          />
          <p className="hint">{t("rt.enterHint")}</p>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={pending || !text.trim()} className="btn btn-primary">
              {pending ? t("admin.common.saving") : t("hr1.chat.send")}
            </button>
            {extra}
          </div>
        </form>
      )}
    </div>
  );
}
