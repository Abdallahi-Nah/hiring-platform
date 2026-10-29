"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { DURATIONS } from "@/lib/live-interview";
import { cancelLiveInterview, resendLiveInvite, scheduleLiveInterview, type LiveResult } from "../live-interview-actions";

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<LiveResult>, okText = "") =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (okText ? { ok: true, text: okText } : null) : { ok: false, text: res.error ?? "" });
    });
  return { pending, msg, run };
}

const Message = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p className={msg.ok ? "text-sm font-semibold text-good" : "error-text"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null;

// Valeur "datetime-local" (heure locale du navigateur) pour une date ISO.
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

// Choix de la date et de la durée, puis envoi de l'invitation. Sert aussi à changer l'heure d'un rendez-vous existant.
export function ScheduleForm({ applicationId, existing }: { applicationId: string; existing?: { scheduledAt: string; minutes: number; active: boolean } }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [when, setWhen] = useState(existing ? toLocalInput(existing.scheduledAt) : "");
  const [minutes, setMinutes] = useState(existing?.minutes ?? 30);
  const [open, setOpen] = useState(!existing);

  if (!open) {
    return <div><button type="button" className="btn w-fit" onClick={() => setOpen(true)}>{t(existing?.active ? "live.hr.reschedule" : "live.hr.scheduleNew")}</button></div>;
  }
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!when) return;
        run(() => scheduleLiveInterview(applicationId, new Date(when).toISOString(), minutes), t("live.hr.sent"));
      }}
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label htmlFor="live-when" className="label">{t("live.hr.when")}</label>
          <input id="live-when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className="field min-w-0" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="live-min" className="label">{t("live.hr.duration")}</label>
          <select id="live-min" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="field">
            {DURATIONS.map((m) => <option key={m} value={m}>{t("live.hr.minutes", { n: m })}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || !when} className="btn btn-primary w-fit">{pending ? t("live.hr.sending") : t("live.hr.schedule")}</button>
        {existing && <button type="button" className="btn" onClick={() => setOpen(false)}>{t("live.hr.close")}</button>}
      </div>
      <p className="hint">{t("live.hr.tzNote")}</p>
      <Message msg={msg} />
    </form>
  );
}

// Lien privé du candidat + renvoyer l'invitation + annuler (en deux clics).
export function LiveActions({ liveId, link, canManage }: { liveId: string; link: string; canManage: boolean }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input readOnly value={link} className="field flex-1 text-sm" aria-label={t("live.hr.link")} onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* le champ reste sélectionnable à la main */
            }
          }}
        >
          {copied ? t("live.hr.copied") : t("live.hr.copy")}
        </button>
      </div>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} className="btn" onClick={() => run(() => resendLiveInvite(liveId), t("live.hr.sent"))}>{t("live.hr.resend")}</button>
          {confirm ? (
            <>
              <button type="button" disabled={pending} className="btn btn-danger" onClick={() => run(() => cancelLiveInterview(liveId))}>{t("live.hr.cancelConfirm")}</button>
              <button type="button" className="btn" onClick={() => setConfirm(false)}>{t("live.hr.keep")}</button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>{t("live.hr.cancel")}</button>
          )}
        </div>
      )}
      <Message msg={msg} />
    </div>
  );
}
