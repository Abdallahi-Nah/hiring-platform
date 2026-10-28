"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { INTERVIEW_EXTENSIONS, MAX_INTERVIEW_BYTES, analyzeInterview } from "@/lib/ai/interview";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STAFF = ["super_admin", "admin"] as const;

export type UploadTicket = { path?: string; token?: string; error?: string };
export type Result = { ok?: boolean; error?: string };

// Vérifie le rôle et que la candidature est visible et soumise.
async function authorize(applicationId: string) {
  const user = await requireUser([...STAFF]);
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return { error: t("admin.common.notFoundApp") };
  if (app.status === "incomplete") return { error: t("admin.errors.incompleteNoInterview") };
  return { user, t };
}

// Étape 1 : une URL signée pour envoyer le fichier directement au stockage.
export async function createInterviewUpload(
  applicationId: string,
  fileName: string,
  size: number
): Promise<UploadTicket> {
  const auth = await authorize(applicationId);
  if ("error" in auth) return { error: auth.error };

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!INTERVIEW_EXTENSIONS.includes(ext)) {
    return { error: auth.t("admin.errors.acceptedFormats", { formats: INTERVIEW_EXTENSIONS.join(", ") }) };
  }
  if (size <= 0 || size > MAX_INTERVIEW_BYTES) {
    return { error: auth.t("admin.errors.fileTooBigCompress") };
  }

  const path = `${applicationId}/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient()
    .storage.from("interviews")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: auth.t("admin.errors.cannotPrepareUpload") };
  return { path, token: data.token };
}

// Étape 2 : le fichier est envoyé, on l'enregistre et on lance l'analyse.
export async function registerInterview(applicationId: string, path: string): Promise<Result> {
  const auth = await authorize(applicationId);
  if ("error" in auth) return { error: auth.error };
  if (!path.startsWith(`${applicationId}/`)) return { error: auth.t("admin.errors.invalidFile") };

  const db = createAdminClient();
  const { data: files } = await db.storage
    .from("interviews")
    .list(applicationId, { search: path.slice(applicationId.length + 1) });
  const file = files?.find((f) => `${applicationId}/${f.name}` === path);
  if (!file) return { error: auth.t("admin.errors.notUploaded") };

  // La taille est contrôlée après l'envoi : un fichier trop gros est supprimé.
  if ((file.metadata?.size ?? 0) > MAX_INTERVIEW_BYTES) {
    await db.storage.from("interviews").remove([path]);
    return { error: auth.t("admin.errors.fileTooBig") };
  }

  const { data: row, error } = await db
    .from("interviews")
    .insert({
      application_id: applicationId,
      media_url: path,
      analysis_status: "pending",
      uploaded_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error || !row) return { error: auth.t("admin.errors.cannotSaveInterview") };

  after(() => analyzeInterview(row.id));
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

export async function addInterviewLink(applicationId: string, link: string): Promise<Result> {
  const auth = await authorize(applicationId);
  if ("error" in auth) return { error: auth.error };

  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return { error: auth.t("admin.errors.invalidUrl") };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: auth.t("admin.errors.invalidUrl") };
  }

  const { error } = await createAdminClient().from("interviews").insert({
    application_id: applicationId,
    link_url: url.toString(),
    uploaded_by: auth.user.id,
  });
  if (error) return { error: auth.t("admin.errors.cannotSaveLink") };
  revalidatePath(`/admin/candidates/${applicationId}`);
  return { ok: true };
}

export async function retryInterviewAnalysis(interviewId: string): Promise<Result> {
  await requireUser([...STAFF]);
  const { t } = await getI18n();

  // On vérifie que l'utilisateur voit cet entretien (règles RLS).
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("interviews")
    .select("id, application_id, media_url")
    .eq("id", interviewId)
    .single();
  if (!row?.media_url) return { error: t("admin.errors.interviewNotFound") };

  await analyzeInterview(row.id);
  revalidatePath(`/admin/candidates/${row.application_id}`);
  return { ok: true };
}
