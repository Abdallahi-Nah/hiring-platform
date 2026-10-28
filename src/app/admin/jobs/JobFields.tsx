import { employmentLabel, workModeLabel } from "@/i18n/labels";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/translate";
import { EMPLOYMENT_TYPES, WORK_MODES, type Criteria } from "@/lib/jobs/schema";

type Job = {
  title?: string;
  reference?: string | null;
  description?: string | null;
  cv_max_mb?: number;
  deadline?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  department?: string | null;
  location?: string | null;
  work_mode?: string | null;
  employment_type?: string | null;
  assignment_enabled?: boolean;
  assignment_required?: boolean;
  evaluation_criteria?: Partial<Criteria>;
};

export function JobFields({ job = {} }: { job?: Job }) {
  const t = useT();
  const c = job.evaluation_criteria ?? {};
  const w = c.weights;
  return (
    <div className="grid gap-5">
      <div className="card grid gap-4">
        <h2 className="sub-title">{t("admin.jobForm.details")}</h2>
        <div>
          <label htmlFor="title" className="label">{t("admin.jobForm.title")}</label>
          <input id="title" name="title" required defaultValue={job.title} className="field" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reference" className="label">{t("admin.jobForm.reference")}</label>
            <input id="reference" name="reference" defaultValue={job.reference ?? ""} className="field" />
          </div>
          <div>
            <label htmlFor="cv_max_mb" className="label">{t("admin.jobForm.cvMax")}</label>
            <input id="cv_max_mb" name="cv_max_mb" type="number" min={1} max={10} defaultValue={job.cv_max_mb ?? 5} className="field" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="department" className="label">{t("admin.jobForm.department")}</label>
            <input id="department" name="department" defaultValue={job.department ?? ""} placeholder={t("admin.jobForm.departmentPlaceholder")} className="field" />
          </div>
          <div>
            <label htmlFor="location" className="label">{t("admin.jobForm.location")}</label>
            <input id="location" name="location" defaultValue={job.location ?? ""} placeholder={t("admin.jobForm.locationPlaceholder")} className="field" />
          </div>
          <div>
            <label htmlFor="work_mode" className="label">{t("admin.jobForm.workMode")}</label>
            <select id="work_mode" name="work_mode" defaultValue={job.work_mode ?? ""} className="field">
              <option value="">{t("admin.jobForm.notSpecified")}</option>
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>{workModeLabel(t, m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="employment_type" className="label">{t("admin.jobForm.contractType")}</label>
            <select id="employment_type" name="employment_type" defaultValue={job.employment_type ?? ""} className="field">
              <option value="">{t("admin.jobForm.notSpecified")}</option>
              {EMPLOYMENT_TYPES.map((c) => (
                <option key={c} value={c}>{employmentLabel(t, c)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <span className="label">{t("admin.jobForm.salary")}</span>
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="salary_min" type="number" min={0} defaultValue={job.salary_min ?? ""} aria-label={t("admin.jobForm.salaryMin")} placeholder={t("admin.jobForm.salaryMin")} className="field" />
            <input name="salary_max" type="number" min={0} defaultValue={job.salary_max ?? ""} aria-label={t("admin.jobForm.salaryMax")} placeholder={t("admin.jobForm.salaryMax")} className="field" />
            <input name="salary_currency" maxLength={3} defaultValue={job.salary_currency ?? ""} aria-label={t("admin.jobForm.salaryCurrency")} placeholder={t("admin.jobForm.salaryCurrency")} dir="ltr" className="field uppercase" />
          </div>
          <p className="hint mt-1">{t("admin.jobForm.salaryHint")}</p>
        </div>
        <div>
          <label htmlFor="deadline" className="label">{t("admin.jobForm.deadline")}</label>
          <input id="deadline" name="deadline" type="date" defaultValue={job.deadline ?? ""} className="field sm:max-w-xs" />
          <p className="hint mt-1">{t("admin.jobForm.deadlineHint")}</p>
        </div>
        <div>
          <label htmlFor="description" className="label">{t("admin.jobForm.description")}</label>
          <textarea id="description" name="description" rows={4} defaultValue={job.description ?? ""} className="field" />
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2">
            <input name="assignment_enabled" type="checkbox" defaultChecked={job.assignment_enabled} className="h-4 w-4 accent-[var(--primary)]" />
            {t("admin.jobForm.assignmentStep")}
          </label>
          <label className="flex items-center gap-2">
            <input name="assignment_required" type="checkbox" defaultChecked={job.assignment_required} className="h-4 w-4 accent-[var(--primary)]" />
            {t("admin.jobForm.assignmentRequired")}
          </label>
        </div>
      </div>

      <div className="card grid gap-4">
        <div>
          <h2 className="sub-title">{t("admin.jobForm.criteria")}</h2>
          <p className="hint mt-1">{t("admin.jobForm.criteriaHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="required_skills" className="label">{t("admin.jobForm.requiredSkills")}</label>
            <input id="required_skills" name="required_skills" defaultValue={c.required_skills?.join(", ")} className="field" />
          </div>
          <div>
            <label htmlFor="min_years" className="label">{t("admin.jobForm.minYears")}</label>
            <input id="min_years" name="min_years" type="number" min={0} defaultValue={c.min_years ?? 0} className="field" />
          </div>
        </div>
        <div>
          <label htmlFor="traits" className="label">{t("admin.jobForm.traits")}</label>
          <input id="traits" name="traits" defaultValue={c.traits?.join(", ")} className="field" />
        </div>
        <div>
          <label htmlFor="responsibilities" className="label">{t("admin.jobForm.responsibilities")}</label>
          <textarea id="responsibilities" name="responsibilities" rows={3} defaultValue={c.responsibilities} className="field" />
        </div>
        <div>
          <p className="label">{t("admin.jobForm.weights")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["skills", "experience", "assignment", "communication"] as const).map((k) => (
              <div key={k}>
                <label htmlFor={`w_${k}`} className="hint block">{t(`admin.jobForm.${k}` as MessageKey)}</label>
                <input id={`w_${k}`} name={`w_${k}`} type="number" min={0} max={100} defaultValue={w?.[k] ?? 25} className="field" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
