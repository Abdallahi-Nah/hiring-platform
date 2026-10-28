"use client";

import { useActionState, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { decisionLabel, statusLabel } from "@/i18n/labels";
import { DECISIONS, MANUAL_STATUSES } from "@/lib/candidates";
import { saveHrEvaluation, sendDecision, setCandidateStatus } from "../actions";

export function StatusForm({ applicationId, status }: { applicationId: string; status: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(setCandidateStatus.bind(null, applicationId), null);
  const locked = status === "incomplete";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm">
      <label htmlFor="status" className="font-semibold">{t("admin.detail.statusLabel")}</label>
      {locked || status === "submitted" ? <span className="hint">{statusLabel(t, status)} {t("admin.detail.automatic")}</span> : null}
      {!locked && (
        <>
          <select
            id="status"
            name="status"
            defaultValue={MANUAL_STATUSES.includes(status as never) ? status : ""}
            className="field-sm"
          >
            <option value="" disabled>
              {t("admin.detail.changeTo")}
            </option>
            {MANUAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(t, s)}
              </option>
            ))}
          </select>
          <button disabled={pending} className="btn !py-1.5">
            {t("admin.detail.update")}
          </button>
        </>
      )}
      {state?.error && <span className="error-text" role="alert">{state.error}</span>}
      {state?.saved && <span className="chip chip-good" role="status">{t("admin.common.saved")}</span>}
    </form>
  );
}

type Hr = {
  hr_score: number | null;
  hr_decision: string | null;
  hr_notes: string | null;
  reason_tags: string[] | null;
} | null;

export function HrEvaluationForm({ applicationId, initial }: { applicationId: string; initial: Hr }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveHrEvaluation.bind(null, applicationId), null);
  const decision = initial?.hr_decision ?? "";
  return (
    <form action={action} className="grid gap-4">
      <fieldset>
        <legend className="label">{t("admin.detail.finalDecision")}</legend>
        <div className="seg">
          {DECISIONS.map((d) => (
            <label key={d.value}>
              <input type="radio" name="hr_decision" value={d.value} defaultChecked={decision === d.value} />
              {decisionLabel(t, d.value)}
            </label>
          ))}
          <label className="col-span-2">
            <input type="radio" name="hr_decision" value="" defaultChecked={decision === ""} />
            {t("admin.decision.notDecided")}
          </label>
        </div>
      </fieldset>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div>
          <label htmlFor="hr_score" className="label">{t("admin.detail.score")}</label>
          <input id="hr_score" name="hr_score" type="number" min={0} max={100} defaultValue={initial?.hr_score ?? ""} className="field" />
        </div>
        <div>
          <label htmlFor="reason_tags" className="label">{t("admin.detail.reasonTags")}</label>
          <input id="reason_tags" name="reason_tags" placeholder={t("admin.detail.reasonPlaceholder")} defaultValue={initial?.reason_tags?.join(", ") ?? ""} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="hr_notes" className="label">{t("admin.detail.notes")}</label>
        <textarea id="hr_notes" name="hr_notes" rows={4} defaultValue={initial?.hr_notes ?? ""} className="field" />
      </div>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      {state?.saved && <p className="chip chip-good w-fit" role="status">✓ {t("admin.common.saved")}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg btn-block">
        {pending ? t("admin.common.saving") : t("admin.detail.saveEvaluation")}
      </button>
    </form>
  );
}

// Bouton en 2 temps (confirmation) : l'email de décision ne part jamais par un seul clic.
export function DecisionEmailButton({
  applicationId,
  decision,
  email,
  sentOn,
}: {
  applicationId: string;
  decision: string | null;
  email: string | null;
  sentOn: string | null;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (sentOn) return <p className="chip chip-good w-fit">✓ {t("admin.detail.decisionEmailSent", { date: sentOn })}</p>;
  if (decision !== "hire" && decision !== "reject") return <p className="hint">{t("admin.detail.decisionEmailHint")}</p>;

  return (
    <div className="grid gap-2">
      {confirming && (
        <p className="text-sm">
          {t("admin.detail.confirmSendDecision", { decision: decisionLabel(t, decision), email: email ?? "" })}
        </p>
      )}
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="btn btn-primary"
          onClick={() => {
            if (!confirming) return setConfirming(true);
            start(async () => {
              const res = await sendDecision(applicationId);
              if (res.error) setError(res.error);
              setConfirming(false);
            });
          }}
        >
          {pending ? t("admin.detail.sendingDecision") : t("admin.detail.sendDecisionEmail")}
        </button>
        {confirming && !pending && (
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            {t("admin.detail.cancelSend")}
          </button>
        )}
      </div>
    </div>
  );
}
