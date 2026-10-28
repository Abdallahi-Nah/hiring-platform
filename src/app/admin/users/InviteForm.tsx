"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { inviteUser } from "./actions";

export function InviteForm({ roles }: { roles: { value: string; label: string }[] }) {
  const t = useT();
  const [state, action, pending] = useActionState(inviteUser, null);

  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div>
        <label htmlFor="invite-email" className="label">{t("admin.users.inviteByEmail")}</label>
        <input id="invite-email" name="email" type="email" placeholder="name@company.com" dir="ltr" required className="field" />
      </div>
      <div>
        <label htmlFor="invite-role" className="label">{t("admin.users.role")}</label>
        <select id="invite-role" name="role" defaultValue="reviewer" className="field">
          {roles.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <button disabled={pending} className="btn btn-primary">
        {pending ? t("admin.users.sendingInvitation") : t("admin.users.sendInvitation")}
      </button>
      {state?.error && <p className="error-text sm:col-span-3" role="alert">{state.error}</p>}
      {state?.ok && <p className="chip chip-good !whitespace-normal sm:col-span-3" role="status">✓ {state.ok}</p>}
    </form>
  );
}
