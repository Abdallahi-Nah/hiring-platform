import { connection } from "next/server";
import { Brand } from "@/components/ui/Brand";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { getI18n } from "@/i18n/server";
import { requireCandidate } from "@/lib/candidate-auth";
import { candidateLogout } from "../candidate/actions";
import { MeTabs } from "./MeTabs";
import Link from "next/link";

export const instant = false;

// Espace du candidat : profil, candidatures, favoris, alertes.
export default async function MeLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const me = await requireCandidate();
  const { t } = await getI18n();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link href="/" aria-label={t("common.home")}><Brand /></Link>
          <span className="flex-1" />
          <span className="hint hidden truncate sm:block" dir="ltr">{me.email}</span>
          <LanguageSwitcher />
          <form action={candidateLogout}>
            <button className="btn">{t("admin.nav.signOut")}</button>
          </form>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-4xl gap-5 px-4 pb-12 pt-6">
        <MeTabs />
        {children}
      </main>
    </div>
  );
}
