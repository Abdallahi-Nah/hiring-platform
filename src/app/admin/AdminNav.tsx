"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDashboard, IconJobs, IconBuilding, IconChat, IconMail, IconSearch, IconUser, IconUsers } from "@/components/ui/icons";
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
    </>
  );
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="nav-badge" aria-label={String(n)}>
      {n > 9 ? "9+" : n}
    </span>
  );
}
