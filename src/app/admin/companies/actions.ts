"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export type CompanyState = { ok?: string; error?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Adresse de page proposée à partir du nom (lettres latines sans accents).
const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, "");

// Crée l'entreprise puis invite son premier Super Admin. Si l'invitation échoue, tout est annulé.
export async function createCompany(_prev: CompanyState, fd: FormData): Promise<CompanyState> {
  await requirePlatformAdmin();
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim();
  const slug = String(fd.get("slug") ?? "").trim().toLowerCase() || slugify(name);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();

  if (name.length < 2 || name.length > 80) return { error: t("admin.companies.errName") };
  if (!SLUG_RE.test(slug) || slug.length > 50) return { error: t("admin.companies.errSlug") };
  if (!EMAIL_RE.test(email)) return { error: t("admin.users.inviteFailed") };

  const db = createAdminClient();
  const { data: company, error } = await db.from("companies").insert({ name, slug }).select("id").single();
  if (error?.code === "23505") return { error: t("admin.companies.errTaken") };
  if (error || !company) return { error: t("admin.companies.errCreate") };

  const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password`,
  });
  if (inviteError || !data.user) {
    await db.from("companies").delete().eq("id", company.id);
    if (inviteError?.code === "email_exists") return { error: t("admin.companies.errOwner") };
    console.error("[create-company]", inviteError?.message);
    return { error: t("admin.users.inviteFailed") };
  }
  await db.from("profiles").upsert({ id: data.user.id, role: "super_admin", company_id: company.id });
  revalidatePath("/admin/companies");
  return { ok: t("admin.companies.created", { email }) };
}

export async function setCompanyActive(id: string, active: boolean): Promise<{ error?: string }> {
  const me = await requirePlatformAdmin();
  const { t } = await getI18n();
  if (!active && id === me.companyId) return { error: t("admin.companies.errOwn") };
  const { error } = await createAdminClient().from("companies").update({ is_active: active }).eq("id", id);
  if (error) return { error: t("admin.companies.errSave") };
  revalidatePath("/admin/companies");
  return {};
}

export async function renameCompany(id: string, _prev: CompanyState, fd: FormData): Promise<CompanyState> {
  await requirePlatformAdmin();
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: t("admin.companies.errName") };
  const { error } = await createAdminClient().from("companies").update({ name }).eq("id", id);
  if (error) return { error: t("admin.companies.errSave") };
  revalidatePath("/admin/companies");
  return { ok: t("admin.common.saved") };
}
