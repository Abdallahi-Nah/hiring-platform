"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatLocale } from "@/i18n/config";
import { IconCalendar } from "@/components/ui/icons";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};

// Calendrier maison (sans bibliothèque) pour les filtres : grand, facile à toucher, EN/FR/AR.
// Le champ caché "name" garde la date au format AAAA-MM-JJ, lue par LiveSearch comme les autres champs.
export function DatePicker({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const { locale, t } = useI18n();
  const fmt = formatLocale(locale);
  const [value, setValue] = useState(defaultValue);
  const now = new Date();
  const today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const start = parse(value) ?? today;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [open, setOpen] = useState(false);
  const [pickMonth, setPickMonth] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  // Sans toucher à l'état React : LiveSearch lit le champ caché, puis la page est rendue de nouveau.
  const commit = (v: string) => {
    setValue(v);
    if (hidden.current) {
      hidden.current.value = v;
      hidden.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  useEffect(() => {
    const form = box.current?.closest("form");
    const onReset = () => {
      if (hidden.current) hidden.current.value = "";
      setValue("");
    };
    form?.addEventListener("livesearch-reset", onReset);
    return () => form?.removeEventListener("livesearch-reset", onReset);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
  const text = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(fmt, { ...o, timeZone: "UTC" }).format(d);
  const weekStart = locale === "fr" ? 1 : 0;
  const weekdays = Array.from({ length: 7 }, (_, i) => text(utc(2023, 0, 1 + ((weekStart + i) % 7)), { weekday: "short" }));
  const offset = (utc(view.y, view.m, 1).getUTCDay() - weekStart + 7) % 7;
  const daysInMonth = utc(view.y, view.m + 1, 0).getUTCDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const months = Array.from({ length: 12 }, (_, m) => text(utc(2023, m, 1), { month: "long" }));
  const shift = (delta: number) => {
    const d = utc(view.y, view.m + (pickMonth ? delta * 12 : delta), 1);
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const selected = parse(value);
  const shown = selected ? text(utc(selected.y, selected.m, selected.d), { dateStyle: "medium" }) : "";

  return (
    <div ref={box} className="relative">
      <input ref={hidden} type="hidden" name={name} defaultValue={defaultValue} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setView({ y: start.y, m: start.m });
            setPickMonth(false);
          }
          setOpen((o) => !o);
        }}
        className="btn !justify-start !gap-2 !px-3 !py-2.5"
      >
        <IconCalendar />
        <span className="text-muted">{label}</span>
        <b>{shown || "—"}</b>
      </button>

      {open && (
        <div role="dialog" aria-label={label} className="card absolute start-0 z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] !p-4 shadow-xl">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" className="btn !h-10 !w-10 !p-0" aria-label={pickMonth ? t("common.year") : t("common.prevMonth")} onClick={() => shift(-1)}>
              <span className="rtl:rotate-180">←</span>
            </button>
            <button
              type="button"
              aria-expanded={pickMonth}
              onClick={() => setPickMonth((v) => !v)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-base font-bold hover:bg-surface-2"
            >
              {pickMonth ? view.y : `${months[view.m]} ${view.y}`}
              <span aria-hidden="true" className="text-xs text-muted">{pickMonth ? "▴" : "▾"}</span>
            </button>
            <button type="button" className="btn !h-10 !w-10 !p-0" aria-label={pickMonth ? t("common.year") : t("common.nextMonth")} onClick={() => shift(1)}>
              <span className="rtl:rotate-180">→</span>
            </button>
          </div>

          {pickMonth ? (
            <div className="grid grid-cols-3 gap-2">
              {months.map((n, m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={m === view.m}
                  onClick={() => {
                    setView({ ...view, m });
                    setPickMonth(false);
                  }}
                  className={`h-12 rounded-lg px-1 text-sm font-semibold capitalize transition ${
                    m === view.m ? "bg-primary text-white" : "border border-line hover:bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdays.map((w, i) => (
                <span key={i} className="py-1 text-xs font-semibold text-muted">{w}</span>
              ))}
              {cells.map((d, i) => {
                if (d == null) return <span key={i} />;
                const isSel = !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;
                const isToday = today.y === view.y && today.m === view.m && today.d === d;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={text(utc(view.y, view.m, d), { dateStyle: "full" })}
                    aria-pressed={isSel}
                    onClick={() => {
                      commit(iso(view.y, view.m, d));
                      setOpen(false);
                    }}
                    className={`h-10 rounded-lg text-sm font-semibold transition ${
                      isSel ? "bg-primary text-white" : isToday ? "border border-primary text-primary hover:bg-primary-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex justify-between">
            <button
              type="button"
              className="text-sm font-semibold text-primary hover:underline"
              onClick={() => {
                commit(iso(today.y, today.m, today.d));
                setOpen(false);
              }}
            >
              {t("common.today")}
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-muted hover:underline"
              onClick={() => {
                commit("");
                setOpen(false);
              }}
            >
              {t("common.clear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
