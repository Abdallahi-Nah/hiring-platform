import { connection } from "next/server";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NameForm } from "../companies/CompanyForms";
import { LogoForm } from "./LogoForm";
import { ProfileForm } from "./ProfileForm";
import { renameMyCompany } from "./actions";

export const instant = false;

export default async function CompanyPage() {
  await connection();
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const { data: company } = await (await createClient())
    .from("companies")
    .select("name, slug, logo_path, description, city, website")
    .eq("id", me.companyId)
    .single();

  return (
    <div className="stack mx-auto w-full max-w-xl">
      <div>
        <h1 className="title">{t("admin.company.title")}</h1>
        <p className="hint mt-1">{t("admin.company.subtitle")}</p>
      </div>
      <div className="card grid gap-3">
        <label className="label">{t("admin.company.name")}</label>
        <NameForm action={renameMyCompany} defaultName={company?.name ?? me.companyName} />
        <LogoForm logoPath={company?.logo_path ?? null} />
        <ProfileForm description={company?.description ?? ""} city={company?.city ?? ""} website={company?.website ?? ""} />
        {company && (
          <p className="hint">
            {t("admin.company.page")}: <a href={`/c/${company.slug}`} className="font-semibold text-primary underline" dir="ltr">/c/{company.slug}</a>
          </p>
        )}
      </div>
    </div>
  );
}
