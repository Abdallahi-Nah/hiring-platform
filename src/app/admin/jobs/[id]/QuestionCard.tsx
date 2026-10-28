"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DEFAULT_CONFIG,
  QUESTION_TYPES,
  type QuestionConfig,
  type QuestionRow,
  type QuestionType,
} from "@/lib/jobs/schema";
import { questionTypeLabel } from "@/i18n/labels";
import { useT } from "@/i18n/client";
import { deleteQuestion, updateQuestion } from "../actions";

const field = "field-sm";
const toNum = (v: string) => (v === "" ? undefined : Number(v));

type Props = {
  question: QuestionRow;
  pages: number[];
  onChange: (q: QuestionRow) => void;
  onDelete: (id: string) => void;
};

export function QuestionCard({ question, pages, onChange, onDelete }: Props) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: question.id,
  });
  const [q, setQ] = useState(question);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<QuestionRow>) => setQ((prev) => ({ ...prev, ...p }));
  const cfg = (p: Partial<QuestionConfig>) => patch({ config: { ...q.config, ...p } });

  async function save() {
    setBusy(true);
    const { id, ...input } = q;
    const res = await updateQuestion(id, input);
    setBusy(false);
    if (res.error) return setMsg(res.error);
    setMsg(t("admin.common.saved"));
    onChange(q);
  }

  async function remove() {
    if (!confirm(t("admin.builder.deleteConfirm"))) return;
    await deleteQuestion(q.id);
    onDelete(q.id);
  }

  const isText = ["short_text", "long_text", "assignment_text"].includes(q.type);
  const hasOptions = q.type === "dropdown" || q.type === "multiple_choice";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="grid min-w-0 gap-3 rounded-xl border border-line bg-surface-2 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={t("admin.builder.drag")}
          className="cursor-grab rounded px-2 py-1 text-muted hover:bg-primary-soft"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <input
          value={q.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={t("admin.builder.label")}
          className={`${field} min-w-0 flex-[1_1_9rem]`}
        />
        <select
          value={q.type}
          onChange={(e) => {
            const type = e.target.value as QuestionType;
            patch({ type, config: DEFAULT_CONFIG[type] });
          }}
          className={`${field} max-w-full`}
        >
          {QUESTION_TYPES.map((qt) => (
            <option key={qt} value={qt}>
              {questionTypeLabel(t, qt)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={q.required}
            onChange={(e) => patch({ required: e.target.checked })}
          />
          {t("admin.builder.required")}
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={q.is_salary}
            onChange={(e) => patch({ is_salary: e.target.checked })}
          />
          {t("admin.builder.salary")}
        </label>
        <label className="flex items-center gap-1">
          {t("admin.builder.pageLabel")}
          <select
            value={q.page_number}
            onChange={(e) => patch({ page_number: Number(e.target.value) })}
            className={field}
          >
            {pages.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {q.type === "number" && (
          <>
            <label>
              {t("admin.builder.min")}{" "}
              <input
                type="number"
                value={q.config.min ?? ""}
                onChange={(e) => cfg({ min: toNum(e.target.value) })}
                className={`${field} w-24`}
              />
            </label>
            <label>
              {t("admin.builder.max")}{" "}
              <input
                type="number"
                value={q.config.max ?? ""}
                onChange={(e) => cfg({ max: toNum(e.target.value) })}
                className={`${field} w-24`}
              />
            </label>
          </>
        )}
        {isText && (
          <>
            <label>
              {t("admin.builder.minLength")}{" "}
              <input
                type="number"
                min={0}
                value={q.config.min_length ?? ""}
                onChange={(e) => cfg({ min_length: toNum(e.target.value) })}
                className={`${field} w-24`}
              />
            </label>
            <label>
              {t("admin.builder.maxLength")}{" "}
              <input
                type="number"
                min={1}
                value={q.config.max_length ?? ""}
                onChange={(e) => cfg({ max_length: toNum(e.target.value) })}
                className={`${field} w-24`}
              />
            </label>
          </>
        )}
        {q.type === "short_text" && (
          <label>
            {t("admin.builder.useAs")}{" "}
            <select
              value={q.config.identity ?? ""}
              onChange={(e) =>
                cfg({ identity: (e.target.value || undefined) as QuestionConfig["identity"] })
              }
              className={field}
            >
              <option value="">{t("admin.builder.regular")}</option>
              <option value="name">{t("admin.builder.applicantName")}</option>
              <option value="email">{t("admin.builder.applicantEmail")}</option>
              <option value="phone">{t("admin.builder.applicantPhone")}</option>
            </select>
          </label>
        )}
        {hasOptions && (
          <label className="flex-1">
            {t("admin.builder.options")}
            <textarea
              rows={3}
              value={(q.config.options ?? []).join("\n")}
              onChange={(e) =>
                cfg({ options: e.target.value.split("\n").filter((o) => o.trim()) })
              }
              className={`${field} w-full`}
            />
          </label>
        )}
        {q.type === "multiple_choice" && (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={!!q.config.multiple}
              onChange={(e) => cfg({ multiple: e.target.checked })}
            />
            {t("admin.builder.multiple")}
          </label>
        )}
        {q.type === "voice" && (
          <label>
            {t("admin.builder.maxDuration")}{" "}
            <input
              type="number"
              min={10}
              max={600}
              value={q.config.max_seconds ?? 180}
              onChange={(e) => cfg({ max_seconds: toNum(e.target.value) })}
              className={`${field} w-24`}
            />
          </label>
        )}
        {q.type === "url" && (
          <label>
            {t("admin.builder.linkType")}{" "}
            <select
              value={q.config.url_kind ?? "other"}
              onChange={(e) =>
                cfg({ url_kind: e.target.value as QuestionConfig["url_kind"] })
              }
              className={field}
            >
              <option value="linkedin">LinkedIn</option>
              <option value="behance">Behance</option>
              <option value="portfolio">{t("admin.builder.portfolio")}</option>
              <option value="assignment_video">{t("admin.builder.assignmentVideo")}</option>
              <option value="other">{t("admin.builder.otherLink")}</option>
            </select>
          </label>
        )}
        {q.type === "file_upload" && (
          <span>{t("admin.builder.cvNote")}</span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="btn btn-primary !py-1.5"
        >
          {t("admin.common.save")}
        </button>
        <button
          type="button"
          onClick={remove}
          className="btn btn-danger !py-1.5"
        >
          {t("admin.common.delete")}
        </button>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}
