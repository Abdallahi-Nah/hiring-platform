"use client";

import { useActionState, useState } from "react";
import { useT } from "@/i18n/client";
import type { PasswordState } from "@/lib/password";

// Formulaire "nouveau mot de passe" (invitation, mot de passe oublié, mon compte).
export function PasswordForm({
  action,
}: {
  action: (prev: PasswordState, fd: FormData) => Promise<PasswordState>;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  const [visible, setVisible] = useState(false);
  const type = visible ? "text" : "password";

  return (
    <form action={formAction} className="grid gap-4">
      <div>
        <label htmlFor="password" className="label">{t("auth.password.new")}</label>
        <div className="flex gap-2">
          <input id="password" name="password" type={type} dir="ltr" autoComplete="new-password" minLength={8} required className="field" />
          <button type="button" className="btn" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
            {visible ? t("auth.password.hide") : t("auth.password.show")}
          </button>
        </div>
        <p className="hint mt-1">{t("auth.password.subtitle")}</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">{t("auth.password.confirm")}</label>
        <input id="confirm" name="confirm" type={type} dir="ltr" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      {state?.ok && <p className="chip chip-good w-fit" role="status">✓ {t("auth.password.saved")}</p>}
      <button disabled={pending} className="btn btn-primary btn-lg btn-block">
        {pending ? t("auth.password.saving") : t("auth.password.save")}
      </button>
    </form>
  );
}
