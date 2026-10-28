"use client";

import { useActionState, useTransition } from "react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { useT } from "@/i18n/client";
import { removeLogo, uploadLogo } from "./actions";

export function LogoForm({ logoPath }: { logoPath: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState(uploadLogo, null);
  const [removing, startRemove] = useTransition();
  return (
    <div className="grid gap-3">
      <label htmlFor="logo" className="label">{t("admin.company.logo")}</label>
      {logoPath && (
        <div className="flex items-center gap-3">
          <CompanyLogo path={logoPath} size={56} />
          <button type="button" disabled={removing} className="btn" onClick={() => startRemove(async () => void (await removeLogo()))}>
            {t("admin.company.removeLogo")}
          </button>
        </div>
      )}
      <form action={action} className="grid gap-2">
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="field" />
        <p className="hint">{t("admin.company.logoHint")}</p>
        {state?.error && <p className="error-text" role="alert">{state.error}</p>}
        {state?.ok && <p className="chip chip-good" role="status">✓ {state.ok}</p>}
        <div>
          <button disabled={pending} className="btn btn-primary">
            {pending ? t("admin.common.saving") : t("admin.company.uploadLogo")}
          </button>
        </div>
      </form>
    </div>
  );
}
