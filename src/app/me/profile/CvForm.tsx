"use client";

import { useActionState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { removeCv, uploadCv } from "../actions";

export function CvForm({ cvName }: { cvName: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState(uploadCv, null);
  const [removing, startRemove] = useTransition();
  return (
    <section className="card grid gap-3" aria-labelledby="cv-h">
      <h2 id="cv-h" className="sub-title">{t("cand.profile.cv")}</h2>
      <p className="hint">{t("cand.profile.cvHint")}</p>
      {cvName && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="chip chip-good !whitespace-normal" dir="auto">✓ {cvName}</span>
          <button type="button" disabled={removing} className="btn" onClick={() => startRemove(async () => void (await removeCv()))}>
            {t("cand.profile.cvRemove")}
          </button>
        </div>
      )}
      <form action={action} className="grid gap-2">
        <input name="cv" type="file" accept=".pdf,.doc,.docx" required aria-label={t("cand.profile.cv")} className="field" />
        {state?.error && <p className="error-text" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-good" role="status">✓ {t("admin.common.saved")}</p>}
        <div>
          <button disabled={pending} className="btn btn-primary">{pending ? t("admin.common.saving") : cvName ? t("cand.profile.cvReplace") : t("cand.profile.cvUpload")}</button>
        </div>
      </form>
    </section>
  );
}
