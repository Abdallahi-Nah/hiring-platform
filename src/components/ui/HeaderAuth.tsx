import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { getAccountKind } from "@/lib/candidate-auth";

// Boutons de connexion de l'en-tête public, selon qui est connecté :
// candidat → "Mon espace", compte RH → "Tableau de bord", personne → connexion candidat + entreprise.
export async function HeaderAuth({ showStaffLink }: { showStaffLink: boolean }) {
  const { t } = await getI18n();
  const kind = await getAccountKind();
  if (kind === "candidate") return <Link href="/me" className="btn btn-primary">{t("cand.nav.mySpace")}</Link>;
  if (kind === "staff") return <Link href="/admin" className="btn btn-primary">{t("admin.nav.dashboard")}</Link>;
  return (
    <>
      <Link href="/candidate/login" className="btn">{t("cand.nav.space")}</Link>
      {showStaffLink && (
        <>
          <Link href="/register" className="btn">{t("common.postJob")}</Link>
          <Link href="/login" className="btn btn-primary">{t("common.staffLogin")}</Link>
        </>
      )}
    </>
  );
}
