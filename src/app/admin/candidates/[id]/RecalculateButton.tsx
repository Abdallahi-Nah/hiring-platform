"use client";

import { useActionState } from "react";
import { IconRefresh } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { recalculateAiScore } from "../actions";

export function RecalculateButton({ applicationId }: { applicationId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(recalculateAiScore.bind(null, applicationId), null);
  return (
    <form action={action} className="grid gap-2">
      <button disabled={pending} className="btn w-fit">
        <IconRefresh /> {pending ? t("admin.detail.evaluating") : t("admin.detail.recalculate")}
      </button>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
    </form>
  );
}
