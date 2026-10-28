import Link from "next/link";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("common.notFoundTitle")}</h1>
      <p>{t("common.notFoundText")}</p>
      <Link href="/" className="underline">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
