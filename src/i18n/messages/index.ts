import type { Locale } from "../config";
import { ar } from "./ar";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export const MESSAGES: Record<Locale, Messages> = { en, fr, ar };
export type { Messages };
