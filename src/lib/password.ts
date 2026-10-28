import type { SupabaseClient } from "@supabase/supabase-js";
import type { TFunction } from "@/i18n/translate";

export type PasswordState = { error?: string; ok?: boolean } | null;

export const MIN_PASSWORD = 8;

// Vérifie le formulaire, puis change le mot de passe de l'utilisateur connecté.
// Retourne un message d'erreur traduit, ou null si tout est bon.
export async function updatePassword(
  supabase: SupabaseClient,
  fd: FormData,
  t: TFunction
): Promise<string | null> {
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return t("auth.password.tooShort");
  if (password !== confirm) return t("auth.password.mismatch");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return t("auth.password.sessionExpired");

  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return null;
  if (error.code === "same_password") return t("auth.password.same");
  if (error.code === "weak_password") return t("auth.password.weak");
  return t("auth.password.cannotSave");
}
