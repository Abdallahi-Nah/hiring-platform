import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { switchAccount } from "./actions";

// Affiché quand un compte RH est connecté : on explique au lieu de renvoyer en boucle vers la connexion.
export async function StaffNotice({ email }: { email: string }) {
  const { t } = await getI18n();
  return (
    <div className="grid gap-3" role="alert">
      <p className="chip chip-warn !whitespace-normal">{t("cand.staff.text", { email })}</p>
      <p className="hint">{t("cand.staff.hint")}</p>
      <Link href="/admin" className="btn btn-block">{t("cand.staff.admin")}</Link>
      <form action={switchAccount}>
        <button className="btn btn-primary btn-block">{t("cand.staff.switch")}</button>
      </form>
    </div>
  );
}
