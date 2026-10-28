import { notFound } from "next/navigation";
import { isExpired } from "@/lib/public-jobs";
import { ClosedJob } from "@/components/ui/PublicShell";
import { getCandidate } from "@/lib/candidate-auth";
import { createClient } from "@/lib/supabase/server";
import { readSession } from "@/lib/applicant/session";
import type { QuestionRow } from "@/lib/jobs/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplyFlow } from "./ApplyFlow";

export const instant = false;

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;
// Les pages de candidature ne doivent pas apparaître dans les moteurs de recherche.
export const metadata = { robots: { index: false, follow: false } };

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) notFound();

  // Lecture côté serveur : les tables ne sont plus ouvertes au public, et les critères
  // d'évaluation ne sont jamais envoyés au candidat (seulement les colonnes ci-dessous).
  const supabase = createAdminClient();
  const { data: job } = await supabase
    .from("job_forms")
    .select("id, title, description, is_active, deadline, cv_max_mb, companies!inner(is_active)")
    .eq("id", jobId)
    .single();
  if (!job) notFound();
  if (!job.is_active || isExpired(job.deadline) || !(job.companies as unknown as { is_active: boolean }).is_active) return <ClosedJob title={job.title} />;

  const { data: questions } = await supabase
    .from("questions")
    .select("id, page_number, position, type, label, required, is_salary, config")
    .eq("job_form_id", jobId)
    .order("page_number")
    .order("position");

  const session = await readSession(jobId);

  // Candidat connecté : nom, email et téléphone du profil préremplis, CV du profil réutilisé.
  const me = await getCandidate();
  const prefill: Record<string, string> = {};
  let profileCv = false;
  if (me) {
    const { data: p } = await (await createClient()).from("candidate_profiles").select("full_name, phone, cv_path").eq("user_id", me.id).maybeSingle();
    for (const q of questions ?? []) {
      const kind = (q.config as { identity?: string } | null)?.identity;
      const v = kind === "name" ? p?.full_name : kind === "email" ? me.email : kind === "phone" ? p?.phone : null;
      if (v) prefill[q.id] = v;
    }
    profileCv = !!p?.cv_path && (questions ?? []).some((q) => q.type === "file_upload");
  }

  // Voix et CV déjà envoyés (après un rechargement de la page).
  let answeredMedia: string[] = [];
  if (session) {
    const db = createAdminClient();
    const [{ data: voice }, { data: resume }] = await Promise.all([
      db
        .from("answers")
        .select("question_id")
        .eq("application_id", session.applicationId)
        .not("audio_url", "is", null),
      db.from("resumes").select("id").eq("application_id", session.applicationId).maybeSingle(),
    ]);
    answeredMedia = voice?.map((a) => a.question_id) ?? [];
    if (resume) {
      answeredMedia.push(
        ...(questions ?? []).filter((q) => q.type === "file_upload").map((q) => q.id)
      );
    }
  }

  return (
    <main>
      <ApplyFlow
        jobId={job.id}
        title={job.title}
        description={job.description}
        questions={(questions ?? []) as QuestionRow[]}
        initialPage={session?.page ?? null}
        answeredMedia={answeredMedia}
        cvMaxMb={job.cv_max_mb}
        signedIn={!!me}
        prefill={prefill}
        profileCv={profileCv}
      />
    </main>
  );
}
