import { connection } from "next/server";
import { Chip } from "@/components/ui/Chip";
import { getI18n } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActiveToggle, CreateCompanyForm, NameForm } from "./CompanyForms";
import { renameCompany } from "./actions";

export const instant = false;

export default async function CompaniesPage() {
  await connection();
  await requirePlatformAdmin();
  const { t } = await getI18n();

  const { data: companies } = await createAdminClient()
    .from("companies")
    .select("id, name, slug, is_active, created_at")
    .order("created_at");

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="title">{t("admin.companies.title")}</h1>
        <p className="hint mt-1">{t("admin.companies.subtitle")}</p>
      </div>

      <CreateCompanyForm />

      {(companies ?? []).length === 0 && <p className="card text-center">{t("admin.companies.none")}</p>}
      <div className="grid gap-3">
        {(companies ?? []).map((c) => (
          <div key={c.id} className="card grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={c.is_active ? "good" : "neutral"}>
                {c.is_active ? t("admin.companies.active") : t("admin.companies.inactive")}
              </Chip>
              <code dir="ltr" className="text-sm text-muted">/?company={c.slug}</code>
              <span className="flex-1" />
              <ActiveToggle id={c.id} active={c.is_active} />
            </div>
            <NameForm action={renameCompany.bind(null, c.id)} defaultName={c.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
