"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { deleteFeedback, saveFeedback, type Ratings } from "../feedback-actions";

export type FeedbackRow = { author_id: string; author_name: string; comment: string | null; updated: string } & Ratings;

const KEYS = ["communication", "technical", "motivation", "culture"] as const;
const avg = (rows: FeedbackRow[], k: (typeof KEYS)[number]) => (rows.length ? rows.reduce((s, r) => s + r[k], 0) / rows.length : null);

// Avis des RH : mes 4 notes + commentaire, et ceux du reste de l'équipe avec la moyenne par critère.
export function Feedback({ applicationId, userId, rows }: { applicationId: string; userId: string; rows: FeedbackRow[] }) {
  const t = useT();
  const mine = rows.find((r) => r.author_id === userId);
  const [ratings, setRatings] = useState<Partial<Ratings>>(mine ? { communication: mine.communication, technical: mine.technical, motivation: mine.motivation, culture: mine.culture } : {});
  const [comment, setComment] = useState(mine?.comment ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const others = rows.filter((r) => r.author_id !== userId);
  const complete = KEYS.every((k) => ratings[k]);

  return (
    <div className="grid gap-5">
      {rows.length > 0 && (
        <div className="grid gap-2">
          <h3 className="font-semibold">{t("fb.teamAvg", { n: rows.length })}</h3>
          <dl className="grid gap-1.5 sm:grid-cols-2">
            {KEYS.map((k) => {
              const a = avg(rows, k);
              return (
                <div key={k} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
                  <dt>{t(`fb.${k}` as "fb.communication")}</dt>
                  <dd className="font-bold">{a === null ? "—" : `${a.toFixed(1)} / 5`}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!complete) return setMsg({ ok: false, text: t("fb.errRatings") });
          start(async () => {
            const res = await saveFeedback(applicationId, ratings as Ratings, comment);
            setMsg(res.ok ? { ok: true, text: t("fb.saved") } : { ok: false, text: res.error ?? "" });
          });
        }}
      >
        <h3 className="font-semibold">{t("fb.yours")}</h3>
        {KEYS.map((k) => (
          <fieldset key={k} className="grid gap-1.5">
            <legend className="label">{t(`fb.${k}` as "fb.communication")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className={`btn !min-h-0 cursor-pointer !px-4 ${ratings[k] === n ? "btn-primary" : ""}`}>
                  <input type="radio" name={`fb-${k}`} value={n} checked={ratings[k] === n} onChange={() => setRatings({ ...ratings, [k]: n })} className="sr-only" />
                  <span aria-label={t("fb.scale", { n })}>{n}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="grid gap-1">
          <label htmlFor="fb-comment" className="label">{t("fb.comment")}</label>
          <textarea id="fb-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} className="field" dir="auto" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary w-fit">{pending ? t("fb.saving") : mine ? t("fb.update") : t("fb.save")}</button>
          {mine && (
            <button
              type="button"
              disabled={pending}
              className="btn btn-danger"
              onClick={() => start(async () => {
                const res = await deleteFeedback(applicationId);
                if (res.ok) {
                  setRatings({});
                  setComment("");
                  setMsg(null);
                } else setMsg({ ok: false, text: res.error ?? "" });
              })}
            >
              {t("admin.common.delete")}
            </button>
          )}
        </div>
        {msg && <p className={msg.ok ? "text-sm font-semibold text-good" : "error-text"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      </form>

      {others.length > 0 && (
        <div className="grid gap-3">
          <h3 className="font-semibold">{t("fb.others")}</h3>
          <ul className="grid gap-3">
            {others.map((r) => (
              <li key={r.author_id} className="rounded-lg border border-line p-3 text-sm">
                <p className="font-semibold" dir="auto">{r.author_name} <span className="hint font-normal">· {r.updated}</span></p>
                <p className="mt-1">{KEYS.map((k) => `${t(`fb.${k}` as "fb.communication")}: ${r[k]}/5`).join(" · ")}</p>
                {r.comment && <p className="mt-1 whitespace-pre-wrap" dir="auto">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
