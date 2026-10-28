"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { requestCandidateReset } from "../actions";

export function CandidateForgotForm() {
  const t = useT();
  const [state, action, pending] = useActionState(requestCandidateReset, null);
  return (
    <form action={action} className="grid gap-4">
      {state?.ok ? (
        <p className="chip chip-good !whitespace-normal" role="status">{t("auth.forgot.sent")}</p>
      ) : (
        <>
          <div>
            <label htmlFor="email" className="label">{t("auth.forgot.email")}</label>
            <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required className="field" />
          </div>
          {state?.error && <p className="error-text" role="alert">{state.error}</p>}
          <button disabled={pending} className="btn btn-primary btn-lg btn-block">
            {pending ? t("auth.forgot.sending") : t("auth.forgot.send")}
          </button>
        </>
      )}
      <Link href="/candidate/login" className="text-center text-sm font-semibold text-primary hover:underline">
        <span className="inline-block rtl:rotate-180">←</span> {t("auth.forgot.back")}
      </Link>
    </form>
  );
}
