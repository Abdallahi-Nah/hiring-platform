import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { Brand } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";

// Cadre commun des pages de connexion, de mot de passe oublié et de nouveau mot de passe.
export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = await getI18n(); // la langue vient du cookie : rendu à chaque demande
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" aria-label={t("common.home")}>
            <Brand />
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="card grid gap-4">
          <div>
            <h1 className="title">{title}</h1>
            {subtitle && <p className="hint mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
