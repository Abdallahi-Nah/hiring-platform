import { connection } from "next/server";
import { isExpired } from "@/lib/public-jobs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/ui/Chip";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/jobs/schema";
import { Builder } from "./Builder";
import { EditJobForm } from "./EditJobForm";
import { JobActions } from "./JobActions";

export const instant = false;

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // rendu à chaque demande (session et heure)
  await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const { id } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase.from("job_forms").select("*").eq("id", id).single();
  if (!job) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, page_number, position, type, label, required, is_salary, config")
    .eq("job_form_id", id)
    .order("page_number")
    .order("position");

  return (
    <div className="grid max-w-3xl gap-8">
      <div className="grid gap-3">
        <Link href="/admin/jobs" className="hint hover:underline">
          <span className="inline-block rtl:rotate-180">←</span> {t("admin.jobs.title")}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h1 className="title" dir="auto">{job.title}</h1>
            <div className="mt-2 flex items-center gap-3">
              <Chip tone={job.is_active ? "good" : "neutral"}>{job.is_active ? t("admin.jobs.active") : t("admin.jobs.inactive")}</Chip>
              {isExpired(job.deadline) && <Chip tone="neutral">{t("admin.jobs.expired")}</Chip>}
              <Link href={`/admin/jobs/${job.id}/candidates`} className="text-sm font-semibold text-primary hover:underline">
                {t("admin.jobForm.viewCandidates")} <span className="inline-block rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
          <JobActions id={job.id} isActive={job.is_active} />
        </div>
      </div>

      <section className="grid gap-3">
        <h2 className="sub-title">{t("admin.jobForm.pagesAndQuestions")}</h2>
        <Builder jobId={job.id} initial={(questions ?? []) as QuestionRow[]} />
      </section>

      <section className="grid gap-3">
        <h2 className="sub-title">{t("admin.jobForm.jobSettings")}</h2>
        <EditJobForm job={job} />
      </section>
    </div>
  );
}
