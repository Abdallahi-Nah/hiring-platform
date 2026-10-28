"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

export function MeTabs() {
  const t = useT();
  const pathname = usePathname();
  const items = [
    { href: "/me/applications", label: t("cand.nav.applications") },
    { href: "/me/saved", label: t("cand.nav.saved") },
    { href: "/me/alerts", label: t("cand.nav.alerts") },
    { href: "/me/profile", label: t("cand.nav.profile") },
  ];
  return (
    <nav className="tabs w-fit max-w-full overflow-x-auto" aria-label={t("cand.nav.label")}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={pathname.startsWith(i.href) ? "on" : ""} aria-current={pathname.startsWith(i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
