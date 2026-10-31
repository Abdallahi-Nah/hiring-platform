import Link from "next/link";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { logout } from "@/app/login/actions";
import { Avatar } from "@/components/ui/Avatar";
import { IconLogout } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { getI18n } from "@/i18n/server";
import { roleLabel } from "@/i18n/labels";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./AdminNav";
import { BurgerButton, Drawer, DrawerProvider } from "./MobileDrawer";
import { LiveSync } from "./LiveSync";
import { NotificationBell } from "./NotificationBell";

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // La session (cookies, expiration du jeton) dépend de l'heure : rendu à chaque demande.
  await connection();
  const user = await requireUser();
  const { t } = await getI18n();
  const { count: unreadMessages } = await (await createClient())
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender", "candidate")
    .is("read_at", null);

  return (
    <DrawerProvider>
      <Drawer>
        {/* Nom et logo de l'entreprise de l'utilisateur (à la place du nom de la plateforme) */}
        <Link href="/admin" className="brand px-2.5 pb-4 pt-1" title={user.companyName} aria-label={user.companyName}>
          {user.companyLogo ? (
            <CompanyLogo path={user.companyLogo} size={30} />
          ) : (
            <span className="brand-mark" aria-hidden>{user.companyName.charAt(0).toUpperCase()}</span>
          )}
          <span className="brand-text truncate text-[15px]" dir="auto">{user.companyName}</span>
        </Link>
        <AdminNav canEmail={user.role !== "reviewer"} isSuperAdmin={user.role === "super_admin"} isPlatformAdmin={user.isPlatformAdmin} unreadMessages={unreadMessages ?? 0} />
        <div className="me">
          <Avatar name={user.fullName ?? user.email} />
          <div className="me-text min-w-0 flex-1 text-[13px]">
            <b className="block truncate">{user.fullName ?? user.email}</b>
            <span className="text-muted">{roleLabel(t, user.role)}</span>
          </div>
          <form action={logout}>
            <button className="btn !p-2" aria-label={t("admin.nav.signOut")} title={t("admin.nav.signOut")}>
              <IconLogout />
            </button>
          </form>
        </div>
      </Drawer>
      <main className="main">
        <div className="mb-4 flex items-center justify-between gap-2">
          <BurgerButton />
          <span className="flex items-center gap-2 ms-auto">
          <NotificationBell />
          <LanguageSwitcher />
          </span>
        </div>
        {children}
        <LiveSync />
      </main>
    </DrawerProvider>
  );
}
