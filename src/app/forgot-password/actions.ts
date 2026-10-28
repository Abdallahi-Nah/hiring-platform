"use server";

import { getI18n } from "@/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; ok?: boolean } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// La réponse est toujours la même : on ne révèle pas si un compte existe pour cet email.
export async function requestReset(_prev: ForgotState, fd: FormData): Promise<ForgotState> {
  const { t } = await getI18n();
  if (!(await rateLimit("forgot-password", 5, 3600))) return { error: t("common.tooMany") };

  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (EMAIL_RE.test(email)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteUrl()}/auth/confirm?next=/set-password`,
    });
    if (error) console.error("[forgot-password]", error.message);
  }
  return { ok: true };
}
