"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { renewTrackLink } from "../message-actions";

export function RenewLink({ applicationId }: { applicationId: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        className="btn w-fit"
        onClick={() => {
          if (!confirm(t("rt.renew.confirm"))) return;
          start(async () => {
            const res = await renewTrackLink(applicationId);
            setMsg(res.ok ? { ok: true, text: t("rt.renew.done") } : { ok: false, text: res.error ?? "" });
          });
        }}
      >
        {t("rt.renew.btn")}
      </button>
      <p className="hint">{t("rt.renew.hint")}</p>
      {msg && <p className={msg.ok ? "text-sm font-semibold text-good" : "error-text"} role="status">{msg.text}</p>}
    </div>
  );
}
