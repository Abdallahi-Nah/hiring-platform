import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const instant = false;

export default async function RegisterPage() {
  await connection();
  const { t } = await getI18n();
  if (await getCurrentUser()) redirect("/admin");

  return (
    <AuthShell title={t("register.title")} subtitle={t("register.subtitle")}>
      <RegisterForm />
    </AuthShell>
  );
}
