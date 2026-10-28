"use server";

import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { updatePassword, type PasswordState } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export async function changeMyPassword(_prev: PasswordState, fd: FormData): Promise<PasswordState> {
  await requireUser();
  const { t } = await getI18n();
  const error = await updatePassword(await createClient(), fd, t);
  return error ? { error } : { ok: true };
}
