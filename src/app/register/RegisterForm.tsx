"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useT } from "@/i18n/client";
import { registerCompany } from "./actions";

export function RegisterForm() {
  const t = useT();
  const [state, action, pending] = useActionState(registerCompany, null);
  const [visible, setVisible] = useState(false);

  if (state?.sentTo) {
    return (
      <div className="grid gap-3">
        <p className="chip chip-good !whitespace-normal" role="status">
          ✓ {t("register.sentTitle")}
        </p>
        <p>{t("register.sentText", { email: state.sentTo })}</p>
        <Link href="/login" className="text-center text-sm font-semibold text-primary hover:underline">
          {t("auth.forgot.back")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <div>
        <label htmlFor="company" className="label">{t("register.company")}</label>
        <input id="company" name="company" required minLength={2} maxLength={80} dir="auto" autoComplete="organization" className="field" />
      </div>
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
          <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
            {t("apply.readPolicy")}
          </a>
        </span>
      </label>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg btn-block">
        {pending ? t("register.submitting") : t("register.submit")}
      </button>
      <p className="text-center text-sm">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">{t("login.signIn")}</Link>
      </p>
    </form>
  );
}
