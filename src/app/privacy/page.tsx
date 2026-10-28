import Link from "next/link";
import { connection } from "next/server";
import { PublicShell } from "@/components/ui/PublicShell";
import { getI18n } from "@/i18n/server";

export const instant = false;

// Durée de conservation annoncée aux candidats.
const RETENTION_MONTHS = 12;

export default async function PrivacyPage() {
  await connection();
  const { t } = await getI18n();
  const params = { months: RETENTION_MONTHS, email: process.env.GMAIL_USER ?? "" };

  return (
    <PublicShell title={t("privacy.title")} subtitle={t("privacy.intro")}>
      <div className="card grid gap-5">
        <p className="chip chip-info w-fit">{t("privacy.retention", params)}</p>
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
          <section key={n} className="grid gap-1">
            <h2 className="font-semibold">{t(`privacy.s${n}Title`)}</h2>
            <p className="text-muted">{t(`privacy.s${n}Text`, params)}</p>
          </section>
        ))}
        <Link href="/" className="btn w-fit">
          <span className="inline-block rtl:rotate-180">←</span> {t("privacy.back")}
        </Link>
      </div>
    </PublicShell>
  );
}
