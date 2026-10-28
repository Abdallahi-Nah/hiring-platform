import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { getI18n } from "@/i18n/server";
import { ForgotForm } from "./ForgotForm";

export const instant = false;

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { t } = await getI18n();
  const sp = await searchParams;

  return (
    <AuthShell title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      <ForgotForm invalidLink={sp.error === "link"} />
    </AuthShell>
  );
}
