import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BellMenu, type BellItem } from "./BellMenu";

// Cloche de l'équipe : nouvelles candidatures et nouveaux messages. Les règles RLS limitent à l'entreprise.
export async function NotificationBell() {
  const user = await requireUser();
  const { locale } = await getI18n();
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("notifications_seen_at").eq("id", user.id).single();
  const seen = me?.notifications_seen_at ?? new Date(0).toISOString();

  const [{ data: rows }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, application_id, created_at, applications(email, job_forms(title))")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).gt("created_at", seen),
  ]);

  const items: BellItem[] = (rows ?? []).map((n) => {
    const app = n.applications as unknown as { email: string | null; job_forms: { title: string } | null } | null;
    return {
      id: n.id,
      kind: n.kind,
      applicationId: n.application_id,
      who: app?.email ?? "—",
      job: app?.job_forms?.title ?? "",
      when: new Date(n.created_at).toLocaleString(formatLocale(locale), { dateStyle: "medium", timeStyle: "short" }),
      unread: n.created_at > seen,
    };
  });
  return <BellMenu items={items} unread={count ?? 0} />;
}
