import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { UUID } from "@/lib/uuid";
import type { LiveMessage } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/server";
import { Thread } from "./Thread";

export const instant = false;

type Row = {
  application_id: string;
  sender: string;
  body: string;
  created_at: string;
  read_at: string | null;
  applications: { email: string | null; job_forms: { title: string } | null } | null;
};
type Conv = { id: string; who: string; job: string; last: string; at: string; unread: number };

// Boîte de réception : une conversation par candidature. Les règles RLS limitent à l'entreprise.
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  await connection();
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const selected = sp.c && UUID.test(sp.c) ? sp.c : null;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("messages")
    .select("application_id, sender, body, created_at, read_at, applications(email, job_forms(title))")
    .order("created_at", { ascending: false })
    .limit(500);

  const convs = new Map<string, Conv>();
  for (const m of (rows ?? []) as unknown as Row[]) {
    let c = convs.get(m.application_id);
    if (!c) {
      c = { id: m.application_id, who: m.applications?.email ?? "—", job: m.applications?.job_forms?.title ?? "", last: m.body, at: m.created_at, unread: 0 };
      convs.set(m.application_id, c);
    }
    if (m.sender === "candidate" && !m.read_at) c.unread++;
  }

  // Conversation ouverte depuis la fiche d'un candidat : elle apparaît même sans message.
  let thread: { id: string; who: string; job: string; token: string; status: string } | null = null;
  if (selected) {
    const { data: app } = await supabase
      .from("applications")
      .select("id, email, status, track_token, job_forms(title)")
      .eq("id", selected)
      .single();
    if (!app) notFound();
    const job = (app.job_forms as unknown as { title: string } | null)?.title ?? "";
    thread = { id: app.id, who: app.email ?? "—", job, token: app.track_token, status: app.status };
    if (!convs.has(app.id)) convs.set(app.id, { id: app.id, who: thread.who, job, last: "", at: "", unread: 0 });
  }

  let initial: LiveMessage[] = [];
  if (thread) {
    const { data } = await supabase
      .from("messages")
      .select("id, sender, sender_name, body, created_at, delivered_at, read_at")
      .eq("application_id", thread.id)
      .order("created_at")
      .limit(200);
    initial = data ?? [];
  }

  const list = [...convs.values()].sort((a, b) => (b.at || "9").localeCompare(a.at || "9"));
  const tag = formatLocale(locale);

  return (
    <div className="stack">
      <div>
        <h1 className="title">{t("rt.inbox.title")}</h1>
        <p className="hint mt-1">{t("rt.inbox.hint")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <section className={`card grid content-start gap-1 !p-2 ${thread ? "hidden md:grid" : ""}`} aria-label={t("rt.inbox.title")}>
          {list.length === 0 && <p className="hint px-2 py-6 text-center">{t("rt.inbox.empty")}</p>}
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/admin/messages?c=${c.id}`}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2 ${c.id === selected ? "bg-surface-2" : ""}`}
              aria-current={c.id === selected ? "true" : undefined}
            >
              <Avatar name={c.who} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${c.unread ? "font-bold" : "font-semibold"}`} dir="auto">{c.who}</span>
                <span className="hint block truncate" dir="auto">{c.job}</span>
                {c.last && <span className={`block truncate text-sm ${c.unread ? "font-semibold" : "text-muted"}`} dir="auto">{c.last}</span>}
              </span>
              {c.unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-bad px-1.5 text-[11px] font-bold leading-5 text-white" aria-label={t("rt.inbox.unread", { n: c.unread })}>
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              )}
            </Link>
          ))}
        </section>

        <section className={`card grid content-start gap-3 ${thread ? "" : "hidden md:grid"}`} aria-label={t("hr1.chat.title")}>
          {thread ? (
            <>
              <div className="flex items-center gap-3">
                <Link href="/admin/messages" className="btn !px-3 md:hidden">{t("rt.inbox.back")}</Link>
                <div className="min-w-0 flex-1">
                  <h2 className="sub-title truncate" dir="auto">{thread.who}</h2>
                  <p className="hint truncate" dir="auto">{thread.job}</p>
                </div>
                <Link href={`/admin/candidates/${thread.id}`} className="btn">{t("rt.inbox.profile")}</Link>
              </div>
              <Thread
                key={thread.id}
                appId={thread.id}
                token={thread.token}
                initial={initial}
                localeTag={tag}
                hrName={user.companyName}
                canWrite={thread.status !== "incomplete"}
                canInvite={user.role !== "reviewer"}
              />
            </>
          ) : (
            <p className="hint py-10 text-center">{t("rt.inbox.pick")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
