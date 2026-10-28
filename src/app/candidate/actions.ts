"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { cleanName } from "@/lib/company-signup";
import { MIN_PASSWORD, updatePassword, type PasswordState } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CandidateState = { error?: string; sentTo?: string; ok?: boolean } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function candidateLogin(_prev: CandidateState, fd: FormData): Promise<CandidateState> {
  const { t } = await getI18n();
  if (!(await rateLimit("candidate-login", 30, 3600))) return { error: t("common.tooMany") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get("email") ?? "").trim(),
    password: String(fd.get("password") ?? ""),
  });
  if (error) return { error: t("login.invalid") };
  redirect(safeNext(fd.get("next"), "/me"));
}

// Crée le compte et envoie l'email de confirmation. Même réponse si l'email a déjà un compte.
export async function candidateRegister(_prev: CandidateState, fd: FormData): Promise<CandidateState> {
  const { t } = await getI18n();
  const fullName = cleanName(fd.get("fullName"), 80);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(fd.get("next"), "/me/profile");

  if (!fullName) return { error: t("register.errName") };
  if (!EMAIL_RE.test(email) || email.length > 200) return { error: t("register.errEmail") };
  if (password.length < MIN_PASSWORD || password.length > 200) return { error: t("auth.password.tooShort") };
  if (fd.get("consent") !== "on") return { error: t("register.errConsent") };
  if (!(await rateLimit("candidate-register", 5, 3600))) return { error: t("common.tooMany") };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: { full_name: fullName, account_type: "candidate" },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { error: t("auth.password.weak") };
    console.error("[candidate-register]", error.code, error.message);
    return { error: t("register.errUnavailable") };
  }
  // Une session ici veut dire que "Confirm email" est désactivé dans Supabase : l'email doit être vérifié.
  if (data.session && data.user) {
    console.error("[candidate-register] 'Confirm email' is disabled in Supabase: registration refused.");
    await supabase.auth.signOut();
    await createAdminClient().auth.admin.deleteUser(data.user.id);
    return { error: t("register.errUnavailable") };
  }
  return { sentTo: email };
}

// Connexion avec Google (le fournisseur se règle dans Supabase).
export async function candidateOAuth(fd: FormData) {
  const provider = String(fd.get("provider"));
  const next = safeNext(fd.get("next"), "/me");
  if (provider !== "google") redirect("/candidate/login");
  if (!(await rateLimit("candidate-oauth", 30, 3600))) redirect("/candidate/login?error=oauth");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    console.error("[candidate-oauth]", provider, error?.message);
    redirect("/candidate/login?error=oauth");
  }
  redirect(data.url);
}

export async function candidateLogout() {
  await (await createClient()).auth.signOut();
  redirect("/");
}

// Change de compte : ferme la session RH puis revient à la connexion candidat.
export async function switchAccount() {
  await (await createClient()).auth.signOut();
  redirect("/candidate/login");
}

// La réponse est toujours la même : on ne révèle pas si un compte existe pour cet email.
export async function requestCandidateReset(_prev: CandidateState, fd: FormData): Promise<CandidateState> {
  const { t } = await getI18n();
  if (!(await rateLimit("candidate-forgot", 5, 3600))) return { error: t("common.tooMany") };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (EMAIL_RE.test(email)) {
    const { error } = await (await createClient()).auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteUrl()}/auth/confirm?next=/candidate/set-password`,
    });
    if (error) console.error("[candidate-forgot]", error.message);
  }
  return { ok: true };
}

export async function setCandidatePassword(_prev: PasswordState, fd: FormData): Promise<PasswordState> {
  const { t } = await getI18n();
  const error = await updatePassword(await createClient(), fd, t);
  if (error) return { error };
  redirect("/me");
}
