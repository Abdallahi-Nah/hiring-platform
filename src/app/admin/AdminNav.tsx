"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDashboard, IconJobs, IconBuilding, IconChat, IconLogout, IconMail, IconSearch, IconUser, IconUsers } from "@/components/ui/icons";
import { logout } from "@/app/login/actions";
import { useT } from "@/i18n/client";

type Item = { href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: number };

export function AdminNav({ isSuperAdmin, isPlatformAdmin, canEmail, unreadMessages }: { isSuperAdmin: boolean; isPlatformAdmin: boolean; canEmail: boolean; unreadMessages: number }) {
  const pathname = usePathname();
  const t = useT();
  const items: Item[] = [
    { href: "/admin", label: t("admin.nav.dashboard"), icon: <IconDashboard />, exact: true },
    { href: "/admin/jobs", label: t("admin.nav.jobs"), icon: <IconJobs /> },
    { href: "/admin/messages", label: t("rt.nav.messages"), icon: <IconChat />, badge: unreadMessages },
    { href: "/admin/search", label: t("hr1.nav.search"), icon: <IconSearch /> },
    ...(canEmail ? [{ href: "/admin/templates", label: t("hr1.nav.templates"), icon: <IconMail /> }] : []),
    ...(isSuperAdmin ? [{ href: "/admin/users", label: t("admin.nav.users"), icon: <IconUsers /> }] : []),
    ...(isSuperAdmin ? [{ href: "/admin/company", label: t("admin.nav.company"), icon: <IconBuilding /> }] : []),
    ...(isPlatformAdmin ? [{ href: "/admin/companies", label: t("admin.nav.companies"), icon: <IconBuilding /> }] : []),
    { href: "/admin/account", label: t("admin.nav.account"), icon: <IconUser /> },
  ];
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));

  return (
    <>
      <nav className="grid gap-1" aria-label={t("admin.nav.main")}>
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            title={i.label}
            aria-label={i.label}
            className={`nav ${active(i) ? "nav-on" : ""}`}
            aria-current={active(i) ? "page" : undefined}
          >
            {i.icon}
            <span className="nav-label">{i.label}</span>
            <Badge n={i.badge} />
          </Link>
        ))}
      </nav>

      {/* Barre du bas sur téléphone */}
      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(66px, 1fr))`, overflowX: "auto" }} aria-label={t("admin.nav.mainMobile")}>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={active(i) ? "tab-on" : ""}>
            <span className="relative">
              {i.icon}
              <Badge n={i.badge} tab />
            </span>
            {i.label}
          </Link>
        ))}
        <form action={logout} className="contents">
          <button type="submit">
            <IconLogout />
            {t("admin.nav.signOut")}
          </button>
        </form>
      </nav>
    </>
  );
}

function Badge({ n, tab }: { n?: number; tab?: boolean }) {
  if (!n) return null;
  return (
    <span
      className={tab ? "absolute -end-2 -top-1 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold leading-4 text-white" : "nav-badge"}
      aria-label={String(n)}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
