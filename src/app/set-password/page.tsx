import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { PasswordForm } from "@/components/ui/PasswordForm";
import { getI18n } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { setPassword } from "./actions";

export const instant = false;

export default async function SetPasswordPage() {
  await connection();
  const { t } = await getI18n();

  // Sans session ouverte par le lien de l'email, on renvoie vers "mot de passe oublié".
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/forgot-password?error=link");

  return (
    <AuthShell title={t("auth.password.title")}>
      <PasswordForm action={setPassword} />
    </AuthShell>
  );
}
