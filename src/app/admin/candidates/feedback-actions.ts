"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

export type FeedbackResult = { ok?: boolean; error?: string };
export type Ratings = { communication: number; technical: number; motivation: number; culture: number };

const valid = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 5;

// Enregistre (ou remplace) l'avis de l'utilisateur sur ce candidat. Les règles RLS vérifient l'entreprise et l'auteur.
export async function saveFeedback(applicationId: string, ratings: Ratings, comment: string): Promise<FeedbackResult> {
  const user = await requireUser();
  const { t } = await getI18n();
  if (!UUID.test(applicationId)) return { error: t("admin.common.notFoundApp") };
  if (![ratings.communication, ratings.technical, ratings.motivation, ratings.culture].every(valid)) return { error: t("fb.errRatings") };
  const text = comment.trim();
  if (text.length > 2000) return { error: t("admin.notes.errLength") };

  const { error } = await (await createClient()).from("interview_feedback").upsert(
    {
      application_id: applicationId,
      author_id: user.id,
      author_name: (user.fullName || user.email).slice(0, 80),
      communication: ratings.communication,
      technical: ratings.technical,
      motivation: ratings.motivation,
      culture: ratings.culture,
      comment: text || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,author_id" },
  );
  if (error) return { error: t("fb.errSave") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

export async function deleteFeedback(applicationId: string): Promise<FeedbackResult> {
  const user = await requireUser();
  const { t } = await getI18n();
  if (!UUID.test(applicationId)) return { error: t("admin.common.notFoundApp") };
  const { error } = await (await createClient()).from("interview_feedback").delete().eq("application_id", applicationId).eq("author_id", user.id);
  if (error) return { error: t("fb.errSave") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}
