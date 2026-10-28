"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { MAX_QUESTIONS, MIN_QUESTIONS } from "@/lib/ai/interview-config";
import { createAiInterview, deleteAiInterview, reevaluateAiInterview, regenerateAiQuestions, saveAiQuestions, sendAiInterview, type IvResult } from "../ai-interview-actions";

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<IvResult>, okText = "") =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? (okText ? { ok: true, text: okText } : null) : { ok: false, text: res.error ?? "" });
    });
  return { pending, msg, run, setMsg };
}

const Message = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p className={msg.ok ? "text-sm font-semibold text-good" : "error-text"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null;

export function CreateInterview({ applicationId }: { applicationId: string }) {
  const t = useT();
  const { pending, msg, run } = useRun();
  return (
    <div className="grid gap-2">
      <button type="button" disabled={pending} className="btn btn-primary w-fit" onClick={() => run(() => createAiInterview(applicationId))}>
        {pending ? t("ivid.hr.creating") : t("ivid.hr.create")}
      </button>
      <Message msg={msg} />
    </div>
  );
}

// Brouillon : les questions écrites par l'IA se modifient, puis l'invitation part par email.
export function QuestionsEditor({ interviewId, initial }: { interviewId: string; initial: string[] }) {
  const t = useT();
  const [qs, setQs] = useState(initial);
  const [writing, setWriting] = useState(false);
  const { pending, msg, run } = useRun();
  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {qs.map((q, i) => (
          <li key={i} className="grid gap-1">
            <label htmlFor={`aiq-${i}`} className="label">{t("ivid.hr.questionN", { n: i + 1 })}</label>
            <div className="flex gap-2">
              <textarea id={`aiq-${i}`} rows={2} maxLength={300} value={q} onChange={(e) => setQs(qs.map((x, j) => (j === i ? e.target.value : x)))} className="field flex-1" dir="auto" />
              {qs.length > MIN_QUESTIONS && (
                <button type="button" className="btn !px-3 self-start" aria-label={t("ivid.hr.remove")} onClick={() => setQs(qs.filter((_, j) => j !== i))}>×</button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {qs.length < MAX_QUESTIONS && <button type="button" className="btn" onClick={() => setQs([...qs, ""])}>{t("ivid.hr.add")}</button>}
        <button type="button" disabled={pending} className="btn" onClick={() => run(() => saveAiQuestions(interviewId, qs), t("ivid.hr.saved"))}>{t("ivid.hr.save")}</button>
        <button
          type="button"
          disabled={pending}
          className="btn"
          onClick={() =>
            run(async () => {
              setWriting(true);
              try {
                return await regenerateAiQuestions(interviewId);
              } finally {
                setWriting(false);
              }
            })
          }
        >
          {writing ? t("ivid.hr.creating") : t("ivid.hr.regenerate")}
        </button>
        <button
          type="button"
          disabled={pending}
          className="btn btn-primary"
          onClick={() =>
            run(async () => {
              const saved = await saveAiQuestions(interviewId, qs);
              if (!saved.ok) return saved;
              return sendAiInterview(interviewId);
            }, t("ivid.hr.sent"))
          }
        >
          {t("ivid.hr.send")}
        </button>
      </div>
      <Message msg={msg} />
    </div>
  );
}

// Lien privé du candidat + actions (renvoyer, réévaluer, supprimer).
export function InterviewActions({ interviewId, link, canResend, canEvaluate }: { interviewId: string; link: string | null; canResend: boolean; canEvaluate: boolean }) {
  const t = useT();
  const { pending, msg, run, setMsg } = useRun();
  return (
    <div className="grid gap-2">
      {link && (
        <div className="grid gap-1">
          <div className="flex gap-2">
            <input readOnly value={link} className="field flex-1 text-sm" aria-label={t("ivid.hr.link")} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setMsg({ ok: true, text: t("ivid.hr.copied") });
                } catch {
                  setMsg({ ok: false, text: link });
                }
              }}
            >
              {t("ivid.hr.copyLink")}
            </button>
          </div>
          <p className="hint">{t("ivid.hr.linkHint")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {canResend && <button type="button" disabled={pending} className="btn" onClick={() => run(() => sendAiInterview(interviewId), t("ivid.hr.sent"))}>{t("ivid.hr.resend")}</button>}
        {canEvaluate && <button type="button" disabled={pending} className="btn" onClick={() => run(() => reevaluateAiInterview(interviewId), t("ivid.hr.evalStarted"))}>{t("ivid.hr.reevaluate")}</button>}
        <button
          type="button"
          disabled={pending}
          className="btn btn-danger"
          onClick={() => {
            if (!confirm(t("ivid.hr.deleteConfirm"))) return;
            run(() => deleteAiInterview(interviewId));
          }}
        >
          {t("ivid.hr.delete")}
        </button>
      </div>
      <Message msg={msg} />
    </div>
  );
}
