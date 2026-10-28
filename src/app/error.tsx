"use client";

import { useT } from "@/i18n/client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("common.errorTitle")}</h1>
      <p>{t("common.errorText")}</p>
      <button onClick={reset} className="rounded border px-4 py-2">
        {t("common.tryAgain")}
      </button>
    </main>
  );
}
