"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";

export type Day = { date: string; label: string; count: number };

// Barres en SVG : les 30 derniers jours, ou les 7 derniers.
export function DailyChart({ days }: { days: Day[] }) {
  const t = useT();
  const [range, setRange] = useState<7 | 30>(30);
  const shown = days.slice(-range);
  const max = Math.max(1, ...shown.map((d) => d.count));
  const total = shown.reduce((s, d) => s + d.count, 0);
  const W = 600;
  const H = 140;
  const step = W / shown.length;
  const bar = Math.max(4, step - (range === 7 ? 16 : 4));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="hint flex-1">{t("admin.dashboard.perDayTotal", { n: total })}</p>
        <div className="flex gap-2" role="group" aria-label={t("admin.dashboard.range")}>
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={`btn ${range === r ? "btn-primary" : ""}`}
            >
              {t("admin.dashboard.lastDays", { n: r })}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={t("admin.dashboard.perDay")} style={{ direction: "ltr" }}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="var(--border-strong)" />
        {shown.map((d, i) => {
          const h = (d.count / max) * (H - 18);
          const x = i * step + (step - bar) / 2;
          return (
            <g key={d.date}>
              <title>{`${d.label}: ${d.count}`}</title>
              <rect x={x} y={H - h} width={bar} height={h} rx="2" fill="var(--primary)" opacity={d.count ? 1 : 0.15} />
              {d.count > 0 && range === 7 && (
                <text x={x + bar / 2} y={H - h - 4} textAnchor="middle" fontSize="12" fill="var(--text)">{d.count}</text>
              )}
              {(range === 7 || i % 5 === 0) && (
                <text x={x + bar / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
