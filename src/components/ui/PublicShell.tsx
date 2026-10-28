import Link from "next/link";
import { Suspense } from "react";
import { getI18n } from "@/i18n/server";
import { Brand } from "./Brand";
import { HeaderAuth } from "./HeaderAuth";
import { LanguageSwitcher } from "./LanguageSwitcher";

// En-tête blanc (sans couleur) et colonne centrée des pages publiques.
// wide : grande zone pour la liste des offres ; sinon colonne étroite (offre, offre fermée).
export async function PublicShell({
  title,
  subtitle,
  showStaffLink = false,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  showStaffLink?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  const width = wide ? "max-w-7xl" : "max-w-[680px]";
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${width}`}>
          <Link href="/" aria-label={t("common.home")}>
            <Brand />
          </Link>
          <span className="flex-1" />
          <LanguageSwitcher />
          <Suspense fallback={null}>
            <HeaderAuth showStaffLink={showStaffLink} />
          </Suspense>
        </div>
      </header>
      <main className={`mx-auto w-full px-4 pb-12 pt-8 ${width}`}>
        <h1 className="title" dir="auto">{title}</h1>
        {subtitle && <p className="hint mt-1 text-[15px]">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      <footer className={`mx-auto w-full px-4 pb-8 text-sm ${width}`}>
        <Link href="/privacy" className="text-muted hover:underline">
          {t("common.privacy")}
        </Link>
      </footer>
    </div>
  );
}

// Message affiché quand une offre n'existe plus ou n'est plus ouverte.
export async function ClosedJob({ title }: { title?: string }) {
  const { t } = await getI18n();
  return (
    <PublicShell title={title ?? t("job.defaultTitle")}>
      <div className="card grid justify-items-center gap-3 py-10 text-center">
        <h2 className="sub-title text-xl">{t("job.closedTitle")}</h2>
        <p className="text-muted">{t("job.closedText")}</p>
        <Link href="/" className="btn btn-primary">
          {t("job.seeOthers")}
        </Link>
      </div>
    </PublicShell>
  );
}
