"use client";

import { useActionState, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { createCompany, renameCompany, setCompanyActive, type CompanyState } from "./actions";

export function CreateCompanyForm() {
  const t = useT();
  const [state, action, pending] = useActionState(createCompany, null);
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-2">
      <h2 className="sub-title sm:col-span-2">{t("admin.companies.newCompany")}</h2>
      <div>
        <label htmlFor="c-name" className="label">{t("admin.companies.name")}</label>
        <input id="c-name" name="name" required minLength={2} maxLength={80} dir="auto" className="field" />
      </div>
      <div>
        <label htmlFor="c-slug" className="label">{t("admin.companies.slug")}</label>
        <input id="c-slug" name="slug" maxLength={50} dir="ltr" placeholder="acme" className="field" />
        <p className="hint mt-1">{t("admin.companies.slugHint")}</p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="c-email" className="label">{t("admin.companies.ownerEmail")}</label>
        <input id="c-email" name="email" type="email" required dir="ltr" className="field" />
      </div>
      {state?.error && <p className="error-text sm:col-span-2" role="alert">{state.error}</p>}
      {state?.ok && <p className="chip chip-good !whitespace-normal sm:col-span-2" role="status">✓ {state.ok}</p>}
      <button disabled={pending} className="btn btn-primary sm:col-span-2 sm:w-fit">
        {pending ? t("admin.companies.creating") : t("admin.companies.create")}
      </button>
    </form>
  );
}

export function NameForm({
  action,
  defaultName,
}: {
  action: (prev: CompanyState, fd: FormData) => Promise<CompanyState>;
  defaultName: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="name" defaultValue={defaultName} required minLength={2} maxLength={80} dir="auto" aria-label={t("admin.companies.name")} className="field !w-auto min-w-0 flex-1" />
      <button disabled={pending} className="btn">{t("admin.company.save")}</button>
      {state?.error && <span className="error-text" role="alert">{state.error}</span>}
      {state?.ok && <span className="chip chip-good" role="status">✓ {state.ok}</span>}
    </form>
  );
}

export function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const t = useT();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        className="btn"
        onClick={() => start(async () => setError((await setCompanyActive(id, !active)).error ?? ""))}
      >
        {active ? t("admin.companies.deactivate") : t("admin.companies.activate")}
      </button>
      {error && <span className="error-text" role="alert">{error}</span>}
    </div>
  );
}
