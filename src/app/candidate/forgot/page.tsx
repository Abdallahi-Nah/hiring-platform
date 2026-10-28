import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { getI18n } from "@/i18n/server";
import { CandidateForgotForm } from "./CandidateForgotForm";

export const instant = false;

export default async function CandidateForgotPage() {
  await connection();
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      <CandidateForgotForm />
    </AuthShell>
  );
}
