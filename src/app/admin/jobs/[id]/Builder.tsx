"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DEFAULT_CONFIG, type QuestionRow } from "@/lib/jobs/schema";
import { useT } from "@/i18n/client";
import { addQuestion, reorderQuestions } from "../actions";
import { QuestionCard } from "./QuestionCard";

export function Builder({
  jobId,
  initial,
}: {
  jobId: string;
  initial: QuestionRow[];
}) {
  const t = useT();
  const [questions, setQuestions] = useState(initial);
  const [extraPages, setExtraPages] = useState(0);
  const [error, setError] = useState("");

  const maxPage = Math.max(1, ...questions.map((q) => q.page_number));
  const pages = Array.from({ length: maxPage + extraPages }, (_, i) => i + 1);

  const byPage = (p: number) =>
    questions.filter((q) => q.page_number === p).sort((a, b) => a.position - b.position);

  async function persist(next: QuestionRow[]) {
    setQuestions(next);
    const res = await reorderQuestions(
      next.map(({ id, page_number, position }) => ({ id, page_number, position }))
    );
    setError(res.error ?? "");
  }

  function onDragEnd(page: number, e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const list = byPage(page);
    const from = list.findIndex((q) => q.id === e.active.id);
    const to = list.findIndex((q) => q.id === e.over!.id);
    const moved = arrayMove(list, from, to).map((q, i) => ({ ...q, position: i }));
    persist([...questions.filter((q) => q.page_number !== page), ...moved]);
  }

  async function add(page: number) {
    const res = await addQuestion(jobId, {
      page_number: page,
      position: byPage(page).length,
      type: "short_text",
      label: t("admin.builder.newQuestion"),
      required: false,
      is_salary: false,
      config: DEFAULT_CONFIG.short_text,
    });
    if (res.error || !res.question) return setError(res.error ?? t("admin.common.error"));
    setError("");
    setQuestions((prev) => [...prev, res.question!]);
  }

  return (
    <div className="grid gap-5">
      {error && <p className="error-text" role="alert">{error}</p>}
      {pages.map((p) => {
        const list = byPage(p);
        return (
          <div key={p} className="card grid min-w-0 gap-3 !p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("admin.builder.page", { n: p })}</h3>
            <DndContext
              id={`page-${p}`}
              collisionDetection={closestCenter}
              onDragEnd={(e) => onDragEnd(p, e)}
            >
              <SortableContext
                items={list.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {list.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    pages={pages}
                    onChange={(upd) => {
                      const moved = upd.page_number !== q.page_number;
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === upd.id
                            ? { ...upd, position: moved ? byPage(upd.page_number).length : x.position }
                            : x
                        )
                      );
                    }}
                    onDelete={(id) =>
                      setQuestions((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
            {list.length === 0 && <p className="hint">{t("admin.builder.noQuestions")}</p>}
            <button
              type="button"
              onClick={() => add(p)}
              className="btn w-fit"
            >
              {t("admin.builder.addQuestion")}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setExtraPages((n) => n + 1)}
        className="btn w-fit"
      >
        {t("admin.builder.addPage")}
      </button>
    </div>
  );
}
