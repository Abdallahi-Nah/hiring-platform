"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { activateAllJobs } from "./actions";

// Active d'un coup tous les brouillons (par exemple après un import CSV).
export function ActivateAll({ count }: { count: number }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={pending}
        className="btn"
        onClick={() => {
          if (!confirm(t("act.confirm", { n: count }))) return;
          start(async () => {
            const res = await activateAllJobs();
            if (res.error) return setMsg({ ok: false, lines: [res.error] });
            const lines = [
              ...(res.activated ? [t("act.done", { n: res.activated })] : []),
              ...(res.noEmail ? [t("act.skipNoEmail", { n: res.noEmail })] : []),
              ...(res.expired ? [t("act.skipExpired", { n: res.expired })] : []),
            ];
            setMsg({ ok: !!res.activated, lines: lines.length ? lines : [t("act.none")] });
            router.refresh();
          });
        }}
      >
        {pending ? t("act.working") : t("act.button", { n: count })}
      </button>
      {msg?.lines.map((l, i) => (
        <p key={i} className={msg.ok && i === 0 ? "text-sm font-semibold text-good" : "hint"} role={msg.ok ? "status" : "alert"}>{l}</p>
      ))}
    </div>
  );
}
