"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useT } from "@/i18n/client";
import { statusLabel } from "@/i18n/labels";
import { moveCandidate } from "@/app/admin/candidates/actions";

export type KanbanCard = { id: string; name: string; score: number | null; rank: number | null; status: string };

// "submitted" est automatique : on peut en sortir, pas y revenir.
const COLUMNS = ["submitted", "under_review", "shortlisted", "interviewed", "evaluated", "final_recommendation_ready"] as const;
const TARGETS = COLUMNS.filter((c) => c !== "submitted");

export function KanbanBoard({ cards: initial }: { cards: KanbanCard[] }) {
  const t = useT();
  const [cards, setCards] = useState(initial);
  const [error, setError] = useState("");
  const [over, setOver] = useState("");
  const [, start] = useTransition();

  function move(id: string, status: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status || !(TARGETS as readonly string[]).includes(status)) return;
    const before = cards;
    setCards(cards.map((c) => (c.id === id ? { ...c, status } : c)));
    setError("");
    start(async () => {
      const res = await moveCandidate(id, status);
      if (res.error) {
        setCards(before);
        setError(res.error);
      }
    });
  }

  return (
    <div className="grid gap-3">
      {error && <p className="error-text" role="alert">{error}</p>}
      <p className="hint">{t("hr1.kanban.hint")}</p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const list = cards.filter((c) => c.status === col);
          const droppable = col !== "submitted";
          return (
            <section
              key={col}
              aria-label={statusLabel(t, col)}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                setOver(col);
              }}
              onDragLeave={() => setOver("")}
              onDrop={(e) => {
                e.preventDefault();
                setOver("");
                move(e.dataTransfer.getData("text/plain"), col);
              }}
              className={`grid min-w-64 flex-1 content-start gap-2 rounded-xl border p-2.5 ${over === col ? "border-primary bg-surface-2" : "border-line bg-surface-2/50"}`}
            >
              <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
                {statusLabel(t, col)}
                <span className="rounded-full bg-surface px-2 text-xs text-muted">{list.length}</span>
              </h3>
              {list.length === 0 && <p className="hint px-1 py-3 text-center">{t("hr1.kanban.empty")}</p>}
              {list.map((c) => (
                <article
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  className="card grid cursor-grab gap-2 !p-3 active:cursor-grabbing"
                >
                  <Link href={`/admin/candidates/${c.id}`} className="flex items-center gap-2" draggable={false}>
                    <Avatar name={c.name} />
                    <b className="min-w-0 flex-1 truncate" dir="auto">{c.name}</b>
                  </Link>
                  <div className="flex items-center justify-between gap-2 text-sm text-muted">
                    <span>{c.score != null ? `${c.score}%` : "—"}</span>
                    {c.rank != null && <span>#{c.rank}</span>}
                  </div>
                  <select
                    aria-label={t("hr1.kanban.moveTo")}
                    value={c.status}
                    onChange={(e) => move(c.id, e.target.value)}
                    className="field !h-9 !py-1 text-sm"
                  >
                    {c.status === "submitted" && <option value="submitted">{statusLabel(t, "submitted")}</option>}
                    {TARGETS.map((s) => (
                      <option key={s} value={s}>{statusLabel(t, s)}</option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
