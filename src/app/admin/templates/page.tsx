import Link from "next/link";
import { connection } from "next/server";
import { LOCALES } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { requireUser } from "@/lib/auth";
import { defaultTemplate, isKind, isLocale, TEMPLATE_KINDS, TEMPLATE_VARS } from "@/lib/email/templated";
import { createClient } from "@/lib/supabase/server";
import { TemplateForm } from "./TemplateForm";

export const instant = false;

const LOCALE_NAME: Record<string, string> = { en: "English", fr: "Français", ar: "العربية" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const me = await requireUser(["super_admin", "admin"]);
  const { t, locale: ui } = await getI18n();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const kind = isKind(get("kind")) ? (get("kind") as (typeof TEMPLATE_KINDS)[number]) : "reject";
  const locale = isLocale(get("locale")) ? get("locale") : ui;

  const { data: saved } = await (await createClient())
    .from("email_templates")
    .select("subject, body")
    .eq("company_id", me.companyId)
    .eq("kind", kind)
    .eq("locale", locale)
    .maybeSingle();
  const tpl = saved ?? defaultTemplate(locale as (typeof LOCALES)[number], kind);

  return (
    <div className="stack mx-auto w-full max-w-2xl">
      <div>
        <h1 className="title">{t("hr1.templates.title")}</h1>
        <p className="hint mt-1">{t("hr1.templates.subtitle")}</p>
      </div>

      <div className="tabs w-fit">
        {TEMPLATE_KINDS.map((k) => (
          <Link key={k} href={`/admin/templates?kind=${k}&locale=${locale}`} className={k === kind ? "on" : ""}>
            {t(`hr1.templates.kind.${k}` as MessageKey)}
          </Link>
        ))}
      </div>
      <div className="tabs w-fit">
        {LOCALES.map((l) => (
          <Link key={l} href={`/admin/templates?kind=${kind}&locale=${l}`} className={l === locale ? "on" : ""}>
            {LOCALE_NAME[l]}
          </Link>
        ))}
      </div>

      <div className="card grid gap-3">
        <p className="hint">{t(`hr1.templates.use.${kind}` as MessageKey)}</p>
        <p className="hint">
          {t("hr1.templates.vars")}{" "}
          {TEMPLATE_VARS.map((v) => (
            <code key={v} dir="ltr" className="me-2">{`{${v}}`}</code>
          ))}
        </p>
        <p className="hint">{saved ? t("hr1.templates.custom") : t("hr1.templates.default")}</p>
        <TemplateForm key={`${kind}-${locale}`} kind={kind} locale={locale} subject={tpl.subject} body={tpl.body} custom={!!saved} />
      </div>
    </div>
  );
}
