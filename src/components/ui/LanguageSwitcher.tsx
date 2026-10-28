"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { useI18n } from "@/i18n/client";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";

// Drapeaux : fichiers SVG de la bibliothèque flag-icons (licence MIT), dans public/flags.
const FLAG_FILE: Record<Locale, string> = { en: "us", fr: "fr", ar: "mr" };

const Flag = ({ l }: { l: Locale }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`/flags/${FLAG_FILE[l]}.svg`}
    alt=""
    width={32}
    height={24}
    className="block shrink-0 rounded-[4px] border border-black/20 object-cover shadow-sm"
    style={{ width: 32, height: 24 }}
  />
);

// Sélecteur de langue : le drapeau puis le nom de la langue (English / Français / العربية).
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.label")}
        onClick={() => setOpen((o) => !o)}
        className="btn !px-3 !py-1.5"
      >
        <Flag l={locale} />
        <span lang={locale}>{LOCALE_LABELS[locale]}</span>
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute end-0 z-50 mt-1 min-w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-surface shadow-lg">
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button
                type="button"
                lang={l}
                onClick={() => {
                  setOpen(false);
                  if (l !== locale)
                    start(async () => {
                      await setLocale(l);
                      router.refresh();
                    });
                }}
                className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-start text-sm font-semibold hover:bg-surface-2 ${l === locale ? "text-primary" : ""}`}
              >
                <Flag l={l} />
                {LOCALE_LABELS[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
