"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { createJob } from "../actions";
import { JobFields } from "../JobFields";

export function NewJobForm() {
  const t = useT();
  const [state, action, pending] = useActionState(createJob, null);
  return (
    <form action={action} className="grid gap-5">
      <JobFields />
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      <div>
        <button disabled={pending} className="btn btn-primary btn-lg">
          {pending ? t("admin.jobForm.creating") : t("admin.jobForm.create")}
        </button>
      </div>
    </form>
  );
}
