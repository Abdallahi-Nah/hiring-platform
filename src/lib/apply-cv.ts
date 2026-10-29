import { readSession } from "@/lib/applicant/session";
import { today } from "@/lib/public-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export const CV_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Vérifie le contenu réel du fichier, pas seulement son nom.
export function hasValidSignature(ext: string, head: Uint8Array) {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (ext === "pdf") return starts(0x25, 0x50, 0x44, 0x46); // %PDF
  if (ext === "docx") return starts(0x50, 0x4b); // PK (zip)
  return starts(0xd0, 0xcf, 0x11, 0xe0); // doc (OLE)
}

export type CvContext = { db: ReturnType<typeof createAdminClient>; maxMb: number; applicationId: string };

// Commun aux deux étapes d'envoi du CV : la session du candidat, l'offre ouverte et la question de type fichier.
// Renvoie un code d'erreur (clé de texte) si une vérification échoue.
export async function cvContext(jobId: string, questionId: string): Promise<{ ctx: CvContext } | { error: "sessionExpired" | "closed" | "invalidQuestion"; status: number }> {
  const session = await readSession(jobId);
  if (!session) return { error: "sessionExpired", status: 401 };
  const db = createAdminClient();
  const [{ data: job }, { data: q }, { data: app }] = await Promise.all([
    db.from("job_forms").select("cv_max_mb, companies!inner(is_active)").eq("id", jobId).eq("is_active", true).eq("companies.is_active", true).or(`deadline.is.null,deadline.gte.${today()}`).single(),
    db.from("questions").select("id, type, page_number, job_form_id").eq("id", questionId).single(),
    db.from("applications").select("id, status").eq("id", session.applicationId).eq("job_form_id", jobId).single(),
  ]);
  if (!job || !app || app.status !== "incomplete") return { error: "closed", status: 403 };
  if (!q || q.job_form_id !== jobId || q.type !== "file_upload" || q.page_number !== session.page) return { error: "invalidQuestion", status: 400 };
  return { ctx: { db, maxMb: job.cv_max_mb, applicationId: app.id } };
}
