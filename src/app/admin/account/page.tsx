import { connection } from "next/server";
import { PasswordForm } from "@/components/ui/PasswordForm";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { changeMyPassword } from "./actions";

export const instant = false;

export default async function AccountPage() {
  await connection();
  const user = await requireUser();
  const { t } = await getI18n();

  return (
    <div className="stack mx-auto w-full max-w-md">
      <div>
        <h1 className="title">{t("admin.account.title")}</h1>
        <p className="hint mt-1" dir="ltr">{user.email}</p>
      </div>
      <div className="card grid gap-4">
        <h2 className="font-semibold">{t("admin.account.changePassword")}</h2>
        <PasswordForm action={changeMyPassword} />
      </div>
    </div>
  );
}
