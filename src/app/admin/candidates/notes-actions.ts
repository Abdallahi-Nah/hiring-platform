"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type NoteResult = { ok?: boolean; error?: string };

// Les règles RLS limitent les notes à l'entreprise ; l'auteur est toujours l'utilisateur connecté.
export async function addNote(applicationId: string, body: string): Promise<NoteResult> {
  const user = await requireUser();
  const { t } = await getI18n();
  const text = body.trim();
  if (!text || text.length > 2000) return { error: t("admin.notes.errLength") };

  const { error } = await (await createClient()).from("candidate_notes").insert({
    application_id: applicationId,
    author_id: user.id,
    author_name: (user.fullName || user.email).slice(0, 80),
    body: text,
  });
  if (error) return { error: t("admin.notes.errSave") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

export async function deleteNote(noteId: string, applicationId: string): Promise<NoteResult> {
  await requireUser();
  const { t } = await getI18n();
  const { error } = await (await createClient()).from("candidate_notes").delete().eq("id", noteId);
  if (error) return { error: t("admin.notes.errSave") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}
