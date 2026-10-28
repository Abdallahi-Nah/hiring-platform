"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { addNote, deleteNote } from "../notes-actions";

export type Note = { id: string; author_id: string; author_name: string; body: string; created: string };

export function Notes({ applicationId, notes, userId }: { applicationId: string; notes: Note[]; userId: string }) {
  const t = useT();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4">
      {notes.length === 0 && <p className="hint">{t("admin.notes.empty")}</p>}
      <ul className="grid gap-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-line p-3">
            <p className="whitespace-pre-wrap" dir="auto">{n.body}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="hint">{n.author_name} · {n.created}</span>
              {n.author_id === userId && (
                <button
                  type="button"
                  disabled={pending}
                  className="text-sm font-semibold text-bad hover:underline"
                  onClick={() => {
                    if (confirm(t("admin.notes.deleteConfirm"))) start(async () => setError((await deleteNote(n.id, applicationId)).error ?? ""));
                  }}
                >
                  {t("admin.common.delete")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addNote(applicationId, text);
            setError(res.error ?? "");
            if (res.ok) setText("");
          });
        }}
      >
        <label htmlFor="note" className="label">{t("admin.notes.add")}</label>
        <textarea id="note" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} className="field" />
        {error && <p className="error-text" role="alert">{error}</p>}
        <div>
          <button disabled={pending || !text.trim()} className="btn btn-primary">
            {pending ? t("admin.common.saving") : t("admin.notes.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
