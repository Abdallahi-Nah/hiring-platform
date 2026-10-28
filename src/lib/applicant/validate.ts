import type { TFunction } from "@/i18n/translate";
import type { QuestionRow } from "@/lib/jobs/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const PHONE_RE = /^\d{8,12}$/;

export type Validation = {
  errors: Record<string, string>;
  clean: Record<string, string | number | string[]>;
};

function isUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Valide les réponses d'une page. Voix et CV sont gérés par leurs propres routes.
// Les messages d'erreur sont traduits avec la fonction t de la langue du candidat.
export function validateAnswers(
  questions: QuestionRow[],
  values: Record<string, unknown>,
  t: TFunction
): Validation {
  const errors: Validation["errors"] = {};
  const clean: Validation["clean"] = {};
  const REQUIRED = t("apply.validation.required");

  for (const q of questions) {
    if (q.type === "voice" || q.type === "file_upload") continue;
    const c = q.config;
    const raw = values[q.id];
    const empty =
      raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0);

    if (empty) {
      if (q.required || c.identity === "email") errors[q.id] = REQUIRED;
      continue;
    }

    switch (q.type) {
      case "short_text":
      case "long_text":
      case "assignment_text": {
        const v = String(raw).trim();
        if (!v) {
          if (q.required || c.identity === "email") errors[q.id] = REQUIRED;
          break;
        }
        if (c.identity === "email" && !EMAIL_RE.test(v)) {
          errors[q.id] = t("apply.validation.email");
        } else if (c.identity === "phone" && !PHONE_RE.test(v)) {
          errors[q.id] = t("apply.validation.phone");
        } else if (c.min_length != null && v.length < c.min_length) {
          errors[q.id] = t("apply.validation.minLength", { n: c.min_length });
        } else if (c.max_length != null && v.length > c.max_length) {
          errors[q.id] = t("apply.validation.maxLength", { n: c.max_length });
        } else {
          clean[q.id] = v;
        }
        break;
      }
      case "number": {
        const n = Number(raw);
        if (!Number.isFinite(n)) errors[q.id] = t("apply.validation.number");
        else if (c.min != null && n < c.min) errors[q.id] = t("apply.validation.min", { n: c.min });
        else if (c.max != null && n > c.max) errors[q.id] = t("apply.validation.max", { n: c.max });
        else clean[q.id] = n;
        break;
      }
      case "dropdown": {
        const v = String(raw);
        if (!(c.options ?? []).includes(v)) errors[q.id] = t("apply.validation.choose");
        else clean[q.id] = v;
        break;
      }
      case "multiple_choice": {
        const list = (Array.isArray(raw) ? raw : [raw]).map(String);
        const options = c.options ?? [];
        if (!list.every((v) => options.includes(v))) {
          errors[q.id] = t("apply.validation.chooseValid");
        } else if (!c.multiple && list.length > 1) {
          errors[q.id] = t("apply.validation.chooseOne");
        } else {
          clean[q.id] = c.multiple ? list : list[0];
        }
        break;
      }
      case "url": {
        const v = String(raw).trim();
        if (!isUrl(v)) errors[q.id] = t("apply.validation.url");
        else clean[q.id] = v;
        break;
      }
    }
  }
  return { errors, clean };
}
