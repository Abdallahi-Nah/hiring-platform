import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/jobs/schema";
import type { PublicJob } from "@/lib/public-jobs";
import { Chip } from "./Chip";

// Étiquettes d'une offre : contrat, mode de travail, lieu, département (traduites).
export async function JobChips({ job }: { job: PublicJob }) {
  const { t, locale } = await getI18n();
  const type = (EMPLOYMENT_TYPES as readonly string[]).includes(job.employment_type ?? "")
    ? t(`jobs.employment.${job.employment_type}` as MessageKey)
    : null;
  const mode = (WORK_MODES as readonly string[]).includes(job.work_mode ?? "")
    ? t(`jobs.workMode.${job.work_mode}` as MessageKey)
    : null;
  const nf = new Intl.NumberFormat(formatLocale(locale));
  const { salary_min: lo, salary_max: hi, salary_currency: cur } = job;
  const salary =
    lo != null && hi != null ? `${nf.format(lo)} – ${nf.format(hi)}` : lo != null ? t("jobs.salaryFrom", { n: nf.format(lo) }) : hi != null ? t("jobs.salaryUpTo", { n: nf.format(hi) }) : null;
  if (!type && !mode && !job.location && !job.department && !salary) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {type && <Chip>{type}</Chip>}
      {mode && <Chip tone="info">{mode}</Chip>}
      {job.location && <Chip tone="neutral"><bdi>{job.location}</bdi></Chip>}
      {job.department && <Chip tone="neutral"><bdi>{job.department}</bdi></Chip>}
      {salary && <Chip tone="good"><bdi>{`${salary}${cur ? ` ${cur}` : ""}`}</bdi></Chip>}
    </div>
  );
}
