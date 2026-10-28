"use client";

import { useActionState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { employmentLabel, workModeLabel } from "@/i18n/labels";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/jobs/schema";
import { deleteAlert, saveAlert } from "../actions";

export function AlertItem({ id, summary }: { id: string; summary: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center gap-3 !p-4">
      <span className="min-w-0 flex-1 font-semibold" dir="auto">{summary}</span>
      <button disabled={pending} className="btn" onClick={() => start(async () => void (await deleteAlert(id)))}>
        {t("admin.common.delete")}
      </button>
    </div>
  );
}

export function AlertForm() {
  const t = useT();
  const [state, action, pending] = useActionState(saveAlert, null);
  return (
    <form action={action} className="card grid gap-4" key={state?.ok ? "ok" : "form"}>
      <h2 className="sub-title">{t("cand.alerts.new")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="al-q" className="label">{t("cand.alerts.query")}</label>
          <input id="al-q" name="query" maxLength={80} dir="auto" className="field" />
        </div>
        <div>
          <label htmlFor="al-loc" className="label">{t("admin.jobForm.location")}</label>
          <input id="al-loc" name="location" maxLength={80} dir="auto" className="field" />
        </div>
        <div>
          <label htmlFor="al-type" className="label">{t("admin.jobForm.contractType")}</label>
          <select id="al-type" name="employment_type" className="field">
            <option value="">{t("home.anyContract")}</option>
            {EMPLOYMENT_TYPES.map((c) => (
              <option key={c} value={c}>{employmentLabel(t, c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="al-mode" className="label">{t("admin.jobForm.workMode")}</label>
          <select id="al-mode" name="work_mode" className="field">
            <option value="">{t("home.anyMode")}</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>{workModeLabel(t, m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="al-sal" className="label">{t("home.minSalary")}</label>
          <input id="al-sal" name="min_salary" type="number" min={0} className="field" />
        </div>
      </div>
      <p className="hint">{t("cand.alerts.hint")}</p>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      <div>
        <button disabled={pending} className="btn btn-primary">{pending ? t("admin.common.saving") : t("cand.alerts.create")}</button>
      </div>
    </form>
  );
}
