"use server";

import { getI18n } from "@/i18n/server";
import { cleanName } from "@/lib/company-signup";
import { MIN_PASSWORD } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string; sentTo?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Crée le compte et envoie l'email de confirmation. L'entreprise n'est créée qu'après la confirmation
// (voir /auth/confirm). La réponse est la même si l'email a déjà un compte.
export async function registerCompany(_prev: RegisterState, fd: FormData): Promise<RegisterState> {
  const { t } = await getI18n();
  const company = cleanName(fd.get("company"), 80);
  const fullName = cleanName(fd.get("fullName"), 80);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (company.length < 2) return { error: t("register.errCompany") };
  if (!fullName) return { error: t("register.errName") };
  if (!EMAIL_RE.test(email) || email.length > 200) return { error: t("register.errEmail") };
  if (password.length < MIN_PASSWORD || password.length > 200) return { error: t("auth.password.tooShort") };
  if (fd.get("consent") !== "on") return { error: t("register.errConsent") };
  if (!(await rateLimit("register", 3, 3600))) return { error: t("common.tooMany") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/admin`,
      data: { company_name: company, full_name: fullName },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: t("auth.password.weak") };
    console.error("[register]", error.code, error.message);
    return { error: t("register.errUnavailable") };
  }

  // Une session ici veut dire que "Confirm email" est désactivé dans Supabase :
  // on refuse (l'email doit être vérifié) et on retire le compte.
  if (data.session && data.user) {
    console.error("[register] 'Confirm email' is disabled in Supabase: registration refused.");
    await supabase.auth.signOut();
    await createAdminClient().auth.admin.deleteUser(data.user.id);
    return { error: t("register.errUnavailable") };
  }
  return { sentTo: email };
}
