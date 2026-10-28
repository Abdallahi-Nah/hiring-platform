"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useT } from "@/i18n/client";
import { OAuthButtons } from "../login/CandidateLoginForm";
import { candidateRegister } from "../actions";

export function CandidateRegisterForm({ next }: { next: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(candidateRegister, null);
  const [visible, setVisible] = useState(false);

  if (state?.sentTo) {
    return (
      <div className="grid gap-3">
        <p className="chip chip-good !whitespace-normal" role="status">✓ {t("register.sentTitle")}</p>
        <p>{t("register.sentText", { email: state.sentTo })}</p>
        <Link href="/candidate/login" className="text-center text-sm font-semibold text-primary hover:underline">{t("auth.forgot.back")}</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <OAuthButtons next={next} />
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="fullName" className="label">{t("register.fullName")}</label>
          <input id="fullName" name="fullName" required maxLength={80} dir="auto" autoComplete="name" className="field" />
        </div>
        <div>
          <label htmlFor="email" className="label">{t("register.email")}</label>
          <input id="email" name="email" type="email" required dir="ltr" autoComplete="email" className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">{t("register.password")}</label>
          <div className="flex gap-2">
            <input id="password" name="password" type={visible ? "text" : "password"} required minLength={8} dir="ltr" autoComplete="new-password" className="field" />
            <button type="button" className="btn" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
              {visible ? t("auth.password.hide") : t("auth.password.show")}
            </button>
          </div>
          <p className="hint mt-1">{t("auth.password.subtitle")}</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" required className="mt-1" />
          <span>
            {t("register.consent")}{" "}
            <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">{t("apply.readPolicy")}</a>
          </span>
        </label>
        {state?.error && <p className="error-text" role="alert">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-lg btn-block">
          {pending ? t("register.submitting") : t("cand.register.submit")}
        </button>
      </form>
      <p className="text-center text-sm">
        {t("register.haveAccount")}{" "}
        <Link href={`/candidate/login?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">{t("login.signIn")}</Link>
      </p>
    </div>
  );
}
