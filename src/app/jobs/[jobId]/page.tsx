import Link from "next/link";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ClosedJob, PublicShell } from "@/components/ui/PublicShell";
import { SaveButton } from "@/components/ui/SaveButton";
import { getCandidate } from "@/lib/candidate-auth";
import { createClient } from "@/lib/supabase/server";
import { ViewTracker } from "@/components/ui/ViewTracker";
import { JobChips } from "@/components/ui/JobChips";
import { getPublicJob } from "@/lib/public-jobs";
import { getI18n } from "@/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  await connection();
  const { t, locale } = await getI18n();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();

  const job = await getPublicJob(jobId);
  if (!job) notFound();
  if (!job.is_active) return <ClosedJob title={job.title} />;

  // Nombre d'étapes du formulaire (information pour le candidat).
  const { data: pages } = await createAdminClient().from("questions").select("page_number").eq("job_form_id", jobId);
  const steps = new Set((pages ?? []).map((p) => p.page_number)).size;

  // Favori : seulement pour un candidat connecté.
  const me = await getCandidate();
  const saved = me ? !!(await (await createClient()).from("saved_jobs").select("job_form_id").eq("job_form_id", job.id).maybeSingle()).data : false;

  return (
    <PublicShell title={job.title} subtitle={job.company?.name}>
      <title>{`${job.title} | ${t("meta.openJobs")}`}</title>
      <ViewTracker jobId={job.id} />
      <div className="card grid gap-5">
        {job.company && (
          <p className="flex items-center gap-3 font-semibold" dir="auto">
            <CompanyLogo path={job.company.logo} size={40} />
            {job.company.name}
          </p>
        )}
        <JobChips job={job} />
        {job.description ? (
          <p className="whitespace-pre-wrap" dir="auto">{job.description}</p>
        ) : (
          <p className="text-muted">{t("job.noDescription")}</p>
        )}
        {job.deadline && (
          <p className="hint">
            {t("job.deadline", { date: new Date(`${job.deadline}T00:00:00Z`).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" }) })}
          </p>
        )}
        {steps > 0 && <p className="hint">{t("job.steps", { n: steps })}</p>}
        <div className="flex gap-2">
          <Link href={`/apply/${job.id}`} className="btn btn-primary btn-lg flex-1">
            {t("job.applyNow")}
          </Link>
          <SaveButton jobId={job.id} saved={saved} />
        </div>
      </div>
      <p className="mt-4 text-center">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {t("job.allJobs")}
        </Link>
      </p>
    </PublicShell>
  );
}
