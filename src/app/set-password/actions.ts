"use server";

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { updatePassword, type PasswordState } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

// Après une invitation ou un mot de passe oublié : on enregistre le mot de passe puis on entre dans l'espace RH.
export async function setPassword(_prev: PasswordState, fd: FormData): Promise<PasswordState> {
  const { t } = await getI18n();
  const error = await updatePassword(await createClient(), fd, t);
  if (error) return { error };
  redirect("/admin");
}
