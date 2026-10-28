import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { PublicShell } from "@/components/ui/PublicShell";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { RETENTION_MONTHS } from "@/lib/ai/interview-config";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID } from "@/lib/uuid";
import { InterviewRoom } from "./InterviewRoom";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

const isPast = (d?: string | null) => !!d && new Date(d) < new Date();

// Page privée du candidat (le jeton secret du lien tient lieu de session).
export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { t, locale } = await getI18n();
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  if (!(await rateLimit("interview-page", 300, 3600))) {
    return (
      <PublicShell title={t("ivid.room.title")}>
        <p className="card text-center">{t("common.tooMany")}</p>
      </PublicShell>
    );
  }

  const db = createAdminClient();
  const { data: iv } = await db
    .from("ai_interviews")
    .select("id, status, questions, expires_at, applications(job_forms(title, companies(name, logo_path)))")
    .eq("token", token)
    .single();
  if (!iv || iv.status === "draft") notFound();
  const job = (iv.applications as unknown as { job_forms: { title: string; companies: { name: string; logo_path: string | null } | null } | null } | null)?.job_forms;
  const questions = ((iv.questions as { text: string }[]) ?? []).map((q) => q.text);
  const { data: rows } = await db.from("ai_interview_answers").select("question_index").eq("interview_id", iv.id);
  const answered = (rows ?? []).map((r) => r.question_index);

  const head = (
    <div className="card grid gap-1">
      <h2 className="sub-title" dir="auto">{job?.title}</h2>
      {job?.companies && (
        <p className="flex items-center gap-2 text-sm font-semibold text-primary" dir="auto">
          <CompanyLogo path={job.companies.logo_path} size={24} />
          {job.companies.name}
        </p>
      )}
    </div>
  );

  if (iv.status === "completed") {
    return (
      <PublicShell title={t("ivid.room.title")}>
        <div className="stack">
          {head}
          <p className="card text-center font-semibold text-good">{t("ivid.room.alreadyDone")}</p>
        </div>
      </PublicShell>
    );
  }
  if (isPast(iv.expires_at)) {
    return (
      <PublicShell title={t("ivid.room.title")}>
        <div className="stack">
          {head}
          <div className="card grid gap-1 text-center">
            <h2 className="sub-title">{t("ivid.room.expiredTitle")}</h2>
            <p className="hint">{t("ivid.room.expiredText")}</p>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={t("ivid.room.title")} subtitle={t("ivid.room.subtitle", { count: questions.length })}>
      <div className="stack">
        {head}
        <InterviewRoom token={token} questions={questions} answered={answered} speechLang={formatLocale(locale)} months={RETENTION_MONTHS} />
      </div>
    </PublicShell>
  );
}
