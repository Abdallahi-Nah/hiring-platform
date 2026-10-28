import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/ui/AuthShell";
import { PasswordForm } from "@/components/ui/PasswordForm";
import { getI18n } from "@/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { setCandidatePassword } from "../actions";

export const instant = false;

export default async function CandidateSetPasswordPage() {
  await connection();
  const { t } = await getI18n();
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/candidate/forgot");
  return (
    <AuthShell title={t("auth.password.title")}>
      <PasswordForm action={setCandidatePassword} />
    </AuthShell>
  );
}
