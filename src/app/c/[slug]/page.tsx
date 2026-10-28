import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { JobChips } from "@/components/ui/JobChips";
import { PublicShell } from "@/components/ui/PublicShell";
import { getI18n } from "@/i18n/server";
import { getPublicJobs } from "@/lib/public-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Page publique d'une entreprise : logo, présentation et offres ouvertes.
export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { t } = await getI18n();
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 50) notFound();

  const { data: company } = await createAdminClient()
    .from("companies")
    .select("name, logo_path, description, city, website, is_active")
    .eq("slug", slug)
    .single();
  if (!company || !company.is_active) notFound();

  const jobs = (await getPublicJobs()).filter((j) => j.company?.slug === slug);

  return (
    <PublicShell title={company.name} showStaffLink>
      <div className="stack">
        <div className="card flex flex-wrap items-start gap-4">
          <CompanyLogo path={company.logo_path} size={72} />
          <div className="min-w-52 flex-1 grid gap-2">
            {company.city && <p className="hint" dir="auto">{company.city}</p>}
            {company.description && <p className="whitespace-pre-wrap" dir="auto">{company.description}</p>}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline" dir="ltr">
                {company.website}
              </a>
            )}
          </div>
        </div>

        <h2 className="sub-title">{t("hr1.companyPage.openJobs", { n: jobs.length })}</h2>
        {jobs.length === 0 && <p className="card text-center hint">{t("hr1.companyPage.noJobs")}</p>}
        {jobs.map((j) => (
          <article key={j.id} className="card grid gap-3 !p-5">
            <h3 className="sub-title text-xl" dir="auto">
              <Link href={`/jobs/${j.id}`} className="hover:underline">{j.title}</Link>
            </h3>
            <JobChips job={j} />
            <div>
              <Link href={`/jobs/${j.id}`} className="btn btn-primary">{t("home.viewApply")}</Link>
            </div>
          </article>
        ))}
      </div>
    </PublicShell>
  );
}
