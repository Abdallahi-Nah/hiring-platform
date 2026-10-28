"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { updateCompanyProfile } from "./actions";

type Props = { description: string; city: string; website: string };

export function ProfileForm({ description, city, website }: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(updateCompanyProfile, null);
  return (
    <form action={action} className="grid gap-3">
      <div>
        <label htmlFor="cp-desc" className="label">{t("hr1.companyPage.description")}</label>
        <textarea id="cp-desc" name="description" defaultValue={description} rows={5} maxLength={1500} dir="auto" className="field" />
        <p className="hint mt-1">{t("hr1.companyPage.descriptionHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-city" className="label">{t("hr1.companyPage.city")}</label>
          <input id="cp-city" name="city" defaultValue={city} maxLength={80} dir="auto" className="field" />
        </div>
        <div>
          <label htmlFor="cp-web" className="label">{t("hr1.companyPage.website")}</label>
          <input id="cp-web" name="website" type="url" defaultValue={website} maxLength={200} placeholder="https://" dir="ltr" className="field" />
        </div>
      </div>
      {state?.error && <p className="error-text" role="alert">{state.error}</p>}
      {state?.ok && <p className="chip chip-good" role="status">✓ {state.ok}</p>}
      <div>
        <button disabled={pending} className="btn btn-primary">{pending ? t("admin.common.saving") : t("hr1.companyPage.save")}</button>
      </div>
    </form>
  );
}
