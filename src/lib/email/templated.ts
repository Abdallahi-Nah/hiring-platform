import { isRtl, LOCALES, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, oneLine } from "./transport";

export const TEMPLATE_KINDS = ["reject", "invite", "offer"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export const TEMPLATE_VARS = ["name", "job", "company"] as const;

export const isKind = (v: string): v is TemplateKind => (TEMPLATE_KINDS as readonly string[]).includes(v);
export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

// Texte par défaut d'un modèle (avec {name}, {job}, {company} laissés tels quels).
export function defaultTemplate(locale: Locale, kind: TemplateKind) {
  const t = makeT(locale);
  return { subject: t(`email1.${kind}Subject` as MessageKey), body: t(`email1.${kind}Body` as MessageKey) };
}

// Prépare l'email d'un candidat : modèle de l'entreprise (dans la langue du candidat) ou texte par défaut.
// Jamais de score ni de note interne dans le message.
export async function buildTemplated(applicationId: string, kind: TemplateKind, baseUrl = "") {
  const db = createAdminClient();
  const { data: app } = await db
    .from("applications")
    .select("email, locale, track_token, job_forms(title, company_id, companies(name))")
    .eq("id", applicationId)
    .single();
  if (!app?.email) return null;
  const info = app.job_forms as unknown as { title: string; company_id: string; companies: { name: string } | null } | null;
  if (!info) return null;

  const locale: Locale = isLocale(app.locale ?? "") ? (app.locale as Locale) : "en";
  const t = makeT(locale);
  const [{ data: nameAnswer }, { data: custom }] = await Promise.all([
    db
      .from("answers")
      .select("value, questions!inner(config)")
      .eq("application_id", applicationId)
      .eq("questions.config->>identity", "name")
      .maybeSingle(),
    db.from("email_templates").select("subject, body").eq("company_id", info.company_id).eq("kind", kind).eq("locale", locale).maybeSingle(),
  ]);

  const vars = {
    name: oneLine(String(nameAnswer?.value ?? "")) || t("email1.fallbackName"),
    job: oneLine(info.title ?? t("email.fallbackJob")),
    company: oneLine(info.companies?.name ?? ""),
  };
  const tpl = custom ?? defaultTemplate(locale, kind);
  const subject = oneLine(fill(tpl.subject, vars)).slice(0, 200);
  const link = baseUrl ? `${baseUrl}/track/${app.track_token}` : "";
  const body = fill(tpl.body, vars);
  const text = link ? `${body}\n\n${t("email1.footer")}\n${link}` : body;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="white-space:pre-wrap">${escapeHtml(p.trim())}</p>`)
    .join("");
  const footer = link ? `<p style="color:#555">${escapeHtml(t("email1.footer"))} <a href="${escapeHtml(link)}">${escapeHtml(t("email1.trackLine"))}</a></p>` : "";
  const html = `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}">${paragraphs}${footer}</div>`;
  return { to: app.email, fromName: info.companies?.name, subject, text, html };
}
