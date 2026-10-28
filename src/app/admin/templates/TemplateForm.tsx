"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { resetTemplate, saveTemplate } from "./actions";

type Props = { kind: string; locale: string; subject: string; body: string; custom: boolean };

export function TemplateForm({ kind, locale, subject, body, custom }: Props) {
  const t = useT();
  const [state, save, saving] = useActionState(saveTemplate, null);
  const [resetState, reset, resetting] = useActionState(resetTemplate, null);
  const msg = state ?? resetState;

  return (
    <div className="grid gap-3">
      <form action={save} className="grid gap-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label htmlFor="tpl-subject" className="label">{t("hr1.templates.subject")}</label>
          <input id="tpl-subject" name="subject" defaultValue={subject} maxLength={150} required dir="auto" className="field" />
        </div>
        <div>
          <label htmlFor="tpl-body" className="label">{t("hr1.templates.body")}</label>
          <textarea id="tpl-body" name="body" defaultValue={body} rows={10} maxLength={3000} required dir="auto" className="field" />
        </div>
        {msg?.error && <p className="error-text" role="alert">{msg.error}</p>}
        {msg?.ok && <p className="text-sm font-semibold text-good" role="status">{msg.ok}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={saving} className="btn btn-primary">{saving ? t("admin.common.saving") : t("hr1.templates.save")}</button>
        </div>
      </form>
      {custom && (
        <form action={reset}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="locale" value={locale} />
          <button disabled={resetting} className="btn">{t("hr1.templates.reset")}</button>
        </form>
      )}
    </div>
  );
}
