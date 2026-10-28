"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { updateJob } from "../actions";
import { JobFields } from "../JobFields";

type Props = { job: { id: string } & Parameters<typeof JobFields>[0]["job"] };

export function EditJobForm({ job }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(updateJob.bind(null, job!.id), null);
  return (
    <form action={action} className="grid gap-5">
      <JobFields job={job} />
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn btn-primary">
          {pending ? t("admin.common.saving") : t("admin.jobForm.saveSettings")}
        </button>
        {state === null ? null : !state?.error && <span className="hint">{t("admin.common.saved")}</span>}
      </div>
    </form>
  );
}
