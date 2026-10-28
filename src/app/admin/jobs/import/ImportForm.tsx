"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { MAX_IMPORT_CHARS, templateCsv } from "@/lib/jobs/csv";
import { importJobs, previewJobImport, type PreviewResult } from "./actions";

export function ImportForm() {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [standard, setStandard] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setText("");
    setFileName("");
    setPreview(null);
    setError("");
    setDone(null);
    if (input.current) input.current.value = "";
  }

  async function onFile(file?: File) {
    setPreview(null);
    setError("");
    if (!file) return;
    if (file.size > MAX_IMPORT_CHARS) return setError(t("imp.err.tooBig"));
    setFileName(file.name);
    setText(await file.text());
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jobs-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (done) {
    return (
      <section className="card grid gap-3" role="status">
        <h2 className="sub-title text-good">{t("imp.done", { n: done.created })}</h2>
        <p className="hint">{t("imp.doneNote")}</p>
        {done.skipped > 0 && <p className="hint">{t("imp.skippedNote", { n: done.skipped })}</p>}
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/jobs" className="btn btn-primary">{t("imp.goJobs")}</Link>
          <button type="button" className="btn" onClick={reset}>{t("imp.another")}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="card grid gap-4" aria-labelledby="up-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="up-h" className="sub-title">{t("imp.fileLabel")}</h2>
        <button type="button" className="btn" onClick={downloadTemplate}>{t("imp.template")}</button>
      </div>
      <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="field" aria-labelledby="up-h" onChange={(e) => void onFile(e.target.files?.[0])} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={standard} onChange={(e) => setStandard(e.target.checked)} className="mt-1" />
        <span>
          <b>{t("imp.stdQuestions")}</b>
          <span className="hint block">{t("imp.stdHint")}</span>
        </span>
      </label>
      <div>
        <button
          type="button"
          disabled={pending || !text}
          className="btn btn-primary"
          onClick={() =>
            start(async () => {
              setError("");
              const res = await previewJobImport(text);
              setPreview(res.error ? null : res);
              setError(res.error ?? "");
            })
          }
        >
          {pending && !preview ? t("imp.checking") : t("imp.preview")}
        </button>
        {fileName && <span className="hint ms-3">{fileName}</span>}
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}

      {preview?.rows && (
        <div className="grid gap-3">
          <p className="font-semibold" role="status">{t("imp.summary", { ok: preview.ok ?? 0, bad: preview.bad ?? 0, warn: preview.warn ?? 0 })}</p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-3 py-2 text-start font-semibold">{t("imp.line")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("imp.jobTitle")}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t("imp.status")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t border-line align-top">
                    <td className="px-3 py-2 tabular-nums">{r.line}</td>
                    <td className="px-3 py-2" dir="auto">{r.title || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`chip ${r.ok ? "chip-good" : "chip-bad"}`}>{r.ok ? t("imp.valid") : t("imp.invalid")}</span>
                      {r.errors.map((e, i) => <p key={i} className="error-text mt-1">{e}</p>)}
                      {r.warnings.map((w, i) => <p key={i} className="mt-1 text-sm text-warn">{w}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button
              type="button"
              disabled={pending || !preview.ok}
              className="btn btn-primary"
              onClick={() =>
                start(async () => {
                  setError("");
                  const res = await importJobs(text, standard);
                  if (res.error) setError(res.error);
                  else setDone({ created: res.created ?? 0, skipped: res.skipped ?? 0 });
                })
              }
            >
              {pending ? t("imp.importing") : t("imp.importBtn", { n: preview.ok ?? 0 })}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
