import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { MESSAGES } from "./messages";
import { translate, type TFunction } from "./translate";

// Langue de la requête : cookie, sinon langue du navigateur, sinon anglais.
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

export async function getI18n(): Promise<{ t: TFunction; locale: Locale }> {
  const locale = await getLocale();
  const messages = MESSAGES[locale];
  return { locale, t: (key, vars) => translate(messages, locale, key, vars) };
}

// Pour les cas où la langue est déjà connue (par exemple un email envoyé plus tard).
export function makeT(locale: Locale): TFunction {
  const messages = MESSAGES[locale];
  return (key, vars) => translate(messages, locale, key, vars);
}
