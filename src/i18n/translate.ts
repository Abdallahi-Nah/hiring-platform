import type { Locale } from "./config";
import type { Messages } from "./messages/en";

export type PluralMsg = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string | PluralMsg ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

// Retrouve un texte par sa clé ("home.title"), choisit la forme du pluriel avec {n}, remplace {variables}.
export function translate(messages: Messages, locale: Locale, key: MessageKey, vars?: Vars): string {
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];

  if (node && typeof node === "object" && "other" in node) {
    const plural = node as PluralMsg;
    const category = vars?.n != null ? new Intl.PluralRules(locale).select(Number(vars.n)) : "other";
    node = plural[category] ?? plural.other;
  }
  if (typeof node !== "string") return key;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}
