"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser, type Role } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES: Role[] = ["super_admin", "admin", "reviewer"];

export type InviteState = { ok?: string; error?: string } | null;

export async function inviteUser(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "reviewer") as Role;
  if (!email || !ROLES.includes(role)) return { error: t("admin.common.invalidData") };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password`,
  });
  if (error?.code === "email_exists") return { error: t("admin.users.alreadyRegistered") };
  if (error || !data.user) {
    console.error("[invite]", error?.message);
    return { error: t("admin.users.inviteFailed") };
  }
  // Seule une invitation crée un profil : un compte sans profil n'a aucun accès.
  await admin.from("profiles").upsert({ id: data.user.id, role, company_id: me.companyId });
  revalidatePath("/admin/users");
  return { ok: t("admin.users.inviteSent", { email }) };
}

export async function changeRole(formData: FormData) {
  const me = await requireUser(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!id || id === me.id || !ROLES.includes(role)) return;

  const admin = createAdminClient();
  // Seulement dans sa propre entreprise ; jamais le propriétaire de la plateforme.
  await admin.from("profiles").update({ role }).eq("id", id).eq("company_id", me.companyId).eq("is_platform_admin", false);
  revalidatePath("/admin/users");
}
