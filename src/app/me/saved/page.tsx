import Link from "next/link";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { JobChips } from "@/components/ui/JobChips";
import { SaveButton } from "@/components/ui/SaveButton";
import { getI18n } from "@/i18n/server";
import { requireCandidate } from "@/lib/candidate-auth";
import { getPublicJobs } from "@/lib/public-jobs";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function SavedPage() {
  await connection();
  const me = await requireCandidate("/me/saved");
  const { t } = await getI18n();
  const { data: rows } = await (await createClient()).from("saved_jobs").select("job_form_id").eq("user_id", me.id);
  const ids = new Set((rows ?? []).map((r) => r.job_form_id));
  const open = (await getPublicJobs()).filter((j) => ids.has(j.id));
  const closed = ids.size - open.length;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="title">{t("cand.saved.title")}</h1>
        <p className="hint mt-1">{t("cand.saved.subtitle")}</p>
      </div>
      {open.length === 0 && (
        <div className="card grid justify-items-center gap-3 py-10 text-center">
          <b>{t("cand.saved.none")}</b>
          <Link href="/" className="btn btn-primary">{t("cand.applications.browse")}</Link>
        </div>
      )}
      {open.map((j) => (
        <article key={j.id} className="card grid gap-3 !p-5">
          <div>
            <h2 className="sub-title text-xl" dir="auto">
              <Link href={`/jobs/${j.id}`} className="hover:underline">{j.title}</Link>
            </h2>
            {j.company && (
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary" dir="auto">
                <CompanyLogo path={j.company.logo} size={24} />
                {j.company.name}
              </p>
            )}
          </div>
          <JobChips job={j} />
          <div className="flex items-center gap-2">
            <Link href={`/jobs/${j.id}`} className="btn btn-primary">{t("home.viewApply")}</Link>
            <SaveButton jobId={j.id} saved />
          </div>
        </article>
      ))}
      {closed > 0 && <p className="hint text-center">{t("cand.saved.closed", { n: closed })}</p>}
    </div>
  );
}
