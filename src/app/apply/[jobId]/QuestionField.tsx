"use client";

import { useT } from "@/i18n/client";
import type { QuestionRow } from "@/lib/jobs/schema";
import { CvUpload } from "./CvUpload";
import { VoiceRecorder } from "./VoiceRecorder";

export type Value = string | string[] | undefined;

type Props = {
  question: QuestionRow;
  value: Value;
  error?: string;
  onChange: (v: Value) => void;
  jobId: string;
  cvMaxMb: number;
  mediaDone: boolean;
  onMediaBusy: (busy: boolean) => void;
  onMediaDone: () => void;
};

export function QuestionField({
  question: q,
  value,
  error,
  onChange,
  jobId,
  cvMaxMb,
  mediaDone,
  onMediaBusy,
  onMediaDone,
}: Props) {
  const t = useT();
  const c = q.config;
  const fieldClass = `field ${error ? "field-error" : ""}`;
  const errorId = `err-${q.id}`;
  const inputId = `q-${q.id}`;
  const aria = { "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined };

  if (q.type === "voice") {
    return (
      <VoiceRecorder
        jobId={jobId}
        question={q}
        done={mediaDone}
        error={error}
        onBusy={onMediaBusy}
        onDone={onMediaDone}
      />
    );
  }

  if (q.type === "file_upload") {
    return (
      <CvUpload
        jobId={jobId}
        question={q}
        maxMb={cvMaxMb}
        done={mediaDone}
        error={error}
        onBusy={onMediaBusy}
        onDone={onMediaDone}
      />
    );
  }

  const str = typeof value === "string" ? value : "";

  let control: React.ReactNode;
  switch (q.type) {
    case "short_text":
      control = (
        <input
          id={inputId}
          dir={c.identity === "email" || c.identity === "phone" ? "ltr" : undefined}
          type={c.identity === "email" ? "email" : c.identity === "phone" ? "tel" : "text"}
          inputMode={c.identity === "phone" ? "numeric" : undefined}
          autoComplete={c.identity === "email" ? "email" : c.identity === "phone" ? "tel" : c.identity === "name" ? "name" : undefined}
          maxLength={c.max_length}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          {...aria}
        />
      );
      break;
    case "long_text":
    case "assignment_text":
      control = (
        <textarea
          id={inputId}
          rows={q.type === "long_text" ? 5 : 8}
          maxLength={c.max_length}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          {...aria}
        />
      );
      break;
    case "number":
      control = (
        <input
          id={inputId}
          type="number"
          min={c.min}
          max={c.max}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          {...aria}
        />
      );
      break;
    case "dropdown":
      control = (
        <select id={inputId} value={str} onChange={(e) => onChange(e.target.value)} className={fieldClass} {...aria}>
          <option value="">{t("apply.select")}</option>
          {(c.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
      break;
    case "multiple_choice": {
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      control = (
        <div className="grid gap-2" role={c.multiple ? "group" : "radiogroup"} aria-labelledby={`${inputId}-label`}>
          {(c.options ?? []).map((o) => (
            <label
              key={o}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type={c.multiple ? "checkbox" : "radio"}
                name={q.id}
                className="h-4 w-4 accent-[var(--primary)]"
                checked={selected.includes(o)}
                onChange={(e) =>
                  onChange(
                    c.multiple
                      ? e.target.checked
                        ? [...selected, o]
                        : selected.filter((x) => x !== o)
                      : o
                  )
                }
              />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "url":
      control = (
        <input
          id={inputId}
          dir="ltr"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
          {...aria}
        />
      );
      break;
  }

  return (
    <div>
      <label id={`${inputId}-label`} htmlFor={inputId} className="label">
        {q.label}
        {q.required && <span className="text-bad"> *</span>}
      </label>
      {control}
      {error && (
        <p id={errorId} className="error-text mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
