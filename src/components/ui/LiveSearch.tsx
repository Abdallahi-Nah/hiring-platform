"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { useT } from "@/i18n/client";

const TEXT_TYPES = new Set(["text", "search", "number", "email", "tel", "url"]);
const DEBOUNCE_MS = 300;

type Props = {
  /** Champs de recherche et filtres (inputs, selects) : valeurs de départ lues dans l'adresse de la page. */
  fields: React.ReactNode;
  /** Résultats affichés sous les filtres (rendus par le serveur). */
  children: React.ReactNode;
  className?: string;
  resultsClassName?: string;
};

// Recherche et filtres "en direct" : la liste se met à jour pendant la frappe (300 ms après la dernière touche)
// ou tout de suite pour un menu ou une case. Les choix sont écrits dans l'adresse (?q=...), donc
// le lien reste partageable et le serveur applique les mêmes règles de sécurité qu'avant.
export function LiveSearch({ fields, children, className = "", resultsClassName = "" }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, start] = useTransition();

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    });
    const qs = params.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onInput(e: React.FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLElement;
    clearTimeout(timer.current);
    const isText =
      (t instanceof HTMLInputElement && TEXT_TYPES.has(t.type)) || t instanceof HTMLTextAreaElement;
    if (isText) timer.current = setTimeout(apply, DEBOUNCE_MS);
    else apply();
  }

  function reset() {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements)) {
      if (el instanceof HTMLInputElement) {
        if (el.type === "hidden") continue;
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      } else if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
      else if (el instanceof HTMLTextAreaElement) el.value = "";
    }
    clearTimeout(timer.current);
    // Les calendriers (champs cachés) se vident eux-mêmes en écoutant cet événement.
    form.dispatchEvent(new Event("livesearch-reset"));
    apply();
  }

  return (
    <>
      <form
        ref={formRef}
        role="search"
        className={className}
        onInput={onInput}
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(timer.current);
          apply();
        }}
      >
        {fields}
        <button type="button" onClick={reset} className="text-sm font-semibold text-muted hover:underline">
          {t("common.reset")}
        </button>
        {/* Sans JavaScript : le formulaire s'envoie normalement avec ce bouton. */}
        <noscript>
          <button className="btn btn-primary">{t("common.apply")}</button>
        </noscript>
      </form>
      <div className={`live-results ${resultsClassName}`} data-pending={pending} aria-busy={pending}>
        <p className="sr-only" role="status" aria-live="polite">
          {pending ? t("common.updating") : ""}
        </p>
        {children}
      </div>
    </>
  );
}
