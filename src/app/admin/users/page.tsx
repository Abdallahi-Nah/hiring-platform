import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { IconSearch } from "@/components/ui/icons";
import { roleLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changeRole } from "./actions";
import { InviteForm } from "./InviteForm";

export const instant = false;

const ROLES = ["super_admin", "admin", "reviewer"];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // rendu à chaque demande (session et heure)
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const roleFilter = typeof sp.role === "string" ? sp.role : "";
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("company_id", me.companyId)
    .order("created_at");

  // Les emails sont dans le service d'authentification (page réservée au Super Admin).
  const { data: auth } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
  const emails = new Map((auth?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const visible = (users ?? []).filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (q && !`${u.full_name ?? ""} ${emails.get(u.id) ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="title">{t("admin.users.title")}</h1>
        <p className="hint mt-1">{t("admin.users.subtitle")}</p>
      </div>

      <InviteForm roles={ROLES.map((r) => ({ value: r, label: roleLabel(t, r) }))} />

      <LiveSearch
        className="flex flex-wrap items-center gap-2.5"
        fields={
          <>
            <div className="relative min-w-60 flex-[1_1_260px]">
              <span className="pointer-events-none absolute start-3 top-3 text-muted"><IconSearch /></span>
              <input name="q" defaultValue={typeof sp.q === "string" ? sp.q : ""} placeholder={t("admin.users.searchPlaceholder")} aria-label={t("admin.users.searchLabel")} autoComplete="off" className="field !ps-10" />
            </div>
            <select name="role" defaultValue={roleFilter} aria-label={t("admin.users.role")} className="field !w-auto">
              <option value="">{t("admin.users.allRoles")}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{roleLabel(t, r)}</option>
              ))}
            </select>
          </>
        }
      >
      <div className="card !p-0">
        {visible.length === 0 && <p className="hint p-4">{t("admin.users.none")}</p>}
        <ul className="divide-y divide-line">
          {visible.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar name={u.full_name ?? emails.get(u.id) ?? u.id} />
              <div className="min-w-0 flex-1">
                <b className="block truncate">{u.full_name ?? emails.get(u.id) ?? u.id.slice(0, 8)}</b>
                <span className="hint truncate">{emails.get(u.id)}{u.id === me.id ? t("admin.users.you") : ""}</span>
              </div>
              <form action={changeRole} className="flex items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <label className="sr-only" htmlFor={`role-${u.id}`}>{t("admin.users.role")}</label>
                <select id={`role-${u.id}`} name="role" defaultValue={u.role} disabled={u.id === me.id} className="field-sm">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel(t, r)}</option>
                  ))}
                </select>
                {u.id !== me.id && <button className="btn !py-1.5">{t("admin.common.save")}</button>}
              </form>
            </li>
          ))}
        </ul>
      </div>
      </LiveSearch>
    </div>
  );
}
