export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

// Chaque langue s'écrit dans sa propre langue dans le sélecteur.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  ar: "العربية",
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const isRtl = (locale: Locale) => locale === "ar";

// Dates et nombres : chiffres 0-9 gardés pour l'arabe (usage courant au Maghreb).
export const formatLocale = (locale: Locale) => (locale === "ar" ? "ar-u-nu-latn" : locale);
