"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { isKind, isLocale } from "@/lib/email/templated";
import { createClient } from "@/lib/supabase/server";

export type TemplateState = { error?: string; ok?: string } | null;

// Les règles RLS limitent les modèles à l'entreprise de l'utilisateur (Super Admin et Admin).
export async function saveTemplate(_prev: TemplateState, fd: FormData): Promise<TemplateState> {
  const me = await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const kind = String(fd.get("kind") ?? "");
  const locale = String(fd.get("locale") ?? "");
  const subject = String(fd.get("subject") ?? "").replace(/[\r\n]+/g, " ").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (!isKind(kind) || !isLocale(locale)) return { error: t("hr1.templates.errSave") };
  if (subject.length < 1 || subject.length > 150 || body.length < 1 || body.length > 3000) {
    return { error: t("hr1.templates.errLength") };
  }
  const { error } = await (await createClient())
    .from("email_templates")
    .upsert(
      { company_id: me.companyId, kind, locale, subject, body, updated_at: new Date().toISOString() },
      { onConflict: "company_id,kind,locale" }
    );
  if (error) return { error: t("hr1.templates.errSave") };
  revalidatePath("/admin/templates");
  return { ok: t("admin.common.saved") };
}

export async function resetTemplate(_prev: TemplateState, fd: FormData): Promise<TemplateState> {
  const me = await requireUser(["super_admin", "admin"]);
  const { t } = await getI18n();
  const kind = String(fd.get("kind") ?? "");
  const locale = String(fd.get("locale") ?? "");
  if (!isKind(kind) || !isLocale(locale)) return { error: t("hr1.templates.errSave") };
  const { error } = await (await createClient())
    .from("email_templates")
    .delete()
    .eq("company_id", me.companyId)
    .eq("kind", kind)
    .eq("locale", locale);
  if (error) return { error: t("hr1.templates.errSave") };
  revalidatePath("/admin/templates");
  return { ok: t("hr1.templates.resetDone") };
}
