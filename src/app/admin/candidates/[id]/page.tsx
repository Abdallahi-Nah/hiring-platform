import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { IconDownload } from "@/components/ui/icons";
import { Ring } from "@/components/ui/Score";
import { requireUser } from "@/lib/auth";
import { recommendationLabel, statusLabel } from "@/i18n/labels";
import { formatLocale } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import {
  RECOMMENDATION_TONE,
  STATUS_TONE,
  answerText,
  type ParsedResume,
} from "@/lib/candidates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AiInterviewSection } from "./AiInterview";
import { LiveInterviewSection } from "./LiveInterview";
import { Feedback, type FeedbackRow } from "./Feedback";
import { AutoRefresh } from "./AutoRefresh";
import { DecisionEmailButton, HrEvaluationForm, StatusForm } from "./HrForms";
import { RenewLink } from "./RenewLink";
import { Notes, type Note } from "./Notes";
import { InterviewUpload, RetryButton } from "./InterviewUpload";
import { RecalculateButton } from "./RecalculateButton";

export const instant = false;

// Les analyses IA tournent en arrière-plan (after) : sans cette durée, Vercel les coupe après 10 à 60 s.
export const maxDuration = 300;

const SIGNED_URL_SECONDS = 300;

type QuestionInfo = { label: string; type: string; page_number: number; position: number; config: { identity?: string } | null };

type InterviewAnalysis = {
  voice_clarity: number;
  confidence: number;
  answer_relevance: number;
  structure: number;
  strengths?: string[];
  weaknesses?: string[];
  tone_notes?: string | null;
  stress_indicators?: string[];
  notable_moments?: { timestamp: string; type: string; note: string }[];
  metrics?: { words_per_minute: number | null; long_pauses: number; filler_words: number; duration_seconds: number };
};

const Tags = ({ items }: { items?: string[] }) =>
  items && items.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <Chip key={t}>{t}</Chip>
      ))}
    </div>
  ) : null;

const AiList = ({ title, items, warn = false }: { title: string; items: unknown; warn?: boolean }) =>
  Array.isArray(items) && items.length > 0 ? (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className={`tick ${warn ? "tick-warn" : ""}`}>
        {items.map((it, i) => (
          <li key={i}>{String(it)}</li>
        ))}
      </ul>
    </div>
  ) : null;

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  // Cette page utilise l'heure actuelle (années d'expérience, liens signés) : rendu à chaque demande.
  await connection();
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const { id } = await params;
  const supabase = await createClient();

  // Toutes ces lectures passent par les règles RLS : le Reviewer ne reçoit jamais le salaire.
  const { data: app } = await supabase
    .from("applications")
    .select("id, status, email, phone, is_duplicate, created_at, submitted_at, decision_email_sent_at, viewed_at, job_form_id, job_forms(title)")
    .eq("id", id)
    .single();
  if (!app) notFound();

  // Toutes les lectures partent en même temps : chaque aller-retour vers la base coûte une demi-seconde ou plus.
  const [{ data: answers }, { data: resume }, { data: profiles }, { data: hr }, { data: ai }, { data: interviews }, { data: noteRows }, { count: unreadMsgs }, , { data: fbRows }] =
    await Promise.all([
      supabase
        .from("answers")
        .select("id, value, audio_url, raw_transcript, clean_transcript, transcript_status, questions(label, type, page_number, position, config)")
        .eq("application_id", id),
      supabase.from("resumes").select("file_url, parsed_data, parse_status").eq("application_id", id).maybeSingle(),
      supabase.from("external_profiles").select("id, type, url, parsed_data").eq("application_id", id),
      supabase.from("hr_evaluations").select("hr_score, hr_decision, hr_notes, reason_tags").eq("application_id", id).maybeSingle(),
      supabase
        .from("ai_evaluations")
        .select("status, score, rank, analysis, sub_scores, strengths, weaknesses, missing_requirements, assignment_comment, recommendation, interview_questions")
        .eq("application_id", id)
        .maybeSingle(),
      supabase
        .from("interviews")
        .select("id, media_url, link_url, analysis_status, score, audio_analysis, transcript, created_at")
        .eq("application_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("candidate_notes")
        .select("id, author_id, author_name, body, created_at")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("application_id", id).eq("sender", "candidate").is("read_at", null),
      // Première ouverture par l'équipe : le candidat voit "Vue".
      app.status !== "incomplete" && !app.viewed_at
        ? Promise.resolve(createAdminClient().from("applications").update({ viewed_at: new Date().toISOString() }).eq("id", id).is("viewed_at", null)).then(() => ({ data: null }))
        : Promise.resolve({ data: null }),
      supabase.from("interview_feedback").select("author_id, author_name, communication, technical, motivation, culture, comment, updated_at").eq("application_id", id).order("updated_at", { ascending: false }),
    ]);
  const feedback: FeedbackRow[] = (fbRows ?? []).map((f) => ({
    ...f,
    updated: new Date(f.updated_at).toLocaleDateString(formatLocale(locale), { dateStyle: "medium" }),
  }));

  const notes: Note[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    author_id: n.author_id,
    author_name: n.author_name,
    body: n.body,
    created: new Date(n.created_at).toLocaleString(formatLocale(locale), { dateStyle: "medium", timeStyle: "short" }),
  }));

  // Liens temporaires (5 minutes) vers les fichiers privés.
  const admin = createAdminClient();
  const sign = async (bucket: string, path: string | null | undefined) =>
    path ? ((await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS)).data?.signedUrl ?? null) : null;
  const [cvUrl, audioPairs, interviewPairs] = await Promise.all([
    sign("resumes", resume?.file_url),
    Promise.all((answers ?? []).filter((a) => a.audio_url).map(async (a) => [a.id, await sign("audio", a.audio_url)] as const)),
    Promise.all((interviews ?? []).filter((i) => i.media_url).map(async (i) => [i.id, await sign("interviews", i.media_url)] as const)),
  ]);
  const audioUrls = new Map(audioPairs);
  const interviewUrls = new Map(interviewPairs);

  const sorted = (answers ?? [])
    .map((a) => ({ ...a, q: a.questions as unknown as QuestionInfo | null }))
    .filter((a) => a.q)
    .sort((a, b) => a.q!.page_number - b.q!.page_number || a.q!.position - b.q!.position);

  const name = answerText(sorted.find((a) => a.q!.config?.identity === "name")?.value) || app.email || t("admin.detail.candidateFallback");
  const analysing = ai?.status === "pending" || (interviews ?? []).some((i) => i.analysis_status === "pending");
  const parsed = resume?.parsed_data as ParsedResume | null;
  const jobTitle = (app.job_forms as unknown as { title: string } | null)?.title;
  const canManage = user.role !== "reviewer";
  const interviewComment = (ai?.analysis as { interview_comment?: string | null } | null)?.interview_comment;

  return (
    <div className="grid gap-5">
      {analysing && <AutoRefresh />}

      <Link href={`/admin/jobs/${app.job_form_id}/candidates`} className="hint hover:underline">
        <span className="inline-block rtl:rotate-180">←</span> {jobTitle ?? t("admin.jobs.candidates")}
      </Link>

      <div className="card flex flex-wrap items-center gap-5">
        <Avatar name={name} large />
        <div className="min-w-52 flex-1">
          <h1 className="title" dir="auto">{name}</h1>
          <div className="hint mt-0.5">
            <bdi>{app.email ?? t("admin.detail.noEmail")}</bdi> · <bdi>{app.phone ?? t("admin.detail.noPhone")}</bdi>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={STATUS_TONE[app.status] ?? "neutral"}>{statusLabel(t, app.status)}</Chip>
            {app.is_duplicate && <Chip tone="neutral">{t("admin.detail.duplicateApplication")}</Chip>}
            {ai?.status === "done" && ai.rank != null && <Chip tone="neutral">{t("admin.candidates.rankN", { n: ai.rank })}</Chip>}
            {ai?.status === "done" && ai.recommendation && (
              <Chip tone={RECOMMENDATION_TONE[ai.recommendation] ?? "neutral"}>
                {t("admin.detail.aiPrefix", { label: recommendationLabel(t, ai.recommendation) })}
              </Chip>
            )}
          </div>
          {app.status !== "incomplete" && (
            <div className="mt-3">
              <a href={`/api/admin/candidates/${app.id}/dossier`} className="btn" download>{t("dossier.button")}</a>
            </div>
          )}
        </div>
        {ai?.status === "done" && ai.score != null && <Ring value={ai.score} />}
        <div className="w-full">
          <StatusForm applicationId={app.id} status={app.status} />
        </div>
      </div>

      <div className="detail">
        <div className="stack">
          <section className="card grid gap-4" aria-labelledby="interview-h">
            <div className="flex items-center gap-3">
              <h2 id="interview-h" className="sub-title flex-1">{t("admin.detail.interview")}</h2>
            </div>
            {(interviews ?? []).length === 0 && <p className="hint">{t("admin.detail.noInterview")}</p>}
            {interviews?.map((i) => {
              const a = i.audio_analysis as InterviewAnalysis | null;
              return (
                <div key={i.id} className="grid gap-3">
                  {i.link_url && (
                    <p className="text-sm">
                      {t("admin.detail.link")}{" "}
                      <a href={i.link_url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline">
                        {i.link_url}
                      </a>{" "}
                      <span className="hint">{t("admin.detail.notAnalysed")}</span>
                    </p>
                  )}
                  {interviewUrls.get(i.id) && <audio controls src={interviewUrls.get(i.id)!} className="w-full" />}
                  {i.analysis_status === "pending" && <p className="hint">{t("admin.detail.analysing")}</p>}
                  {i.analysis_status === "failed" && (
                    <p className="error-text">
                      {t("admin.detail.analysisFailed")} {canManage && <RetryButton interviewId={i.id} />}
                    </p>
                  )}
                  {i.analysis_status === "done" && a && (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip tone="good">{t("admin.detail.interviewScore", { n: i.score ?? 0 })}</Chip>
                        <Chip tone="neutral">{t("admin.detail.clarity")} {a.voice_clarity}</Chip>
                        <Chip tone="neutral">{t("admin.detail.confidence")} {a.confidence}</Chip>
                        <Chip tone="neutral">{t("admin.detail.relevance")} {a.answer_relevance}</Chip>
                        <Chip tone="neutral">{t("admin.detail.structure")} {a.structure}</Chip>
                        {a.metrics && (
                          <Chip tone="neutral">
                            {t("admin.detail.metrics", { wpm: a.metrics.words_per_minute ?? "?", pauses: a.metrics.long_pauses, fillers: a.metrics.filler_words })}
                          </Chip>
                        )}
                      </div>
                      <AiList title={t("admin.detail.strengths")} items={a.strengths} />
                      <AiList title={t("admin.detail.weaknesses")} items={a.weaknesses} warn />
                      {a.tone_notes && (
                        <p className="text-sm">
                          <b>{t("admin.detail.tone")}</b> {a.tone_notes}
                        </p>
                      )}
                      <AiList title={t("admin.detail.stress")} items={a.stress_indicators} warn />
                      {a.notable_moments && a.notable_moments.length > 0 && (
                        <div>
                          <h3 className="mb-1 text-sm font-semibold">{t("admin.detail.moments")}</h3>
                          {a.notable_moments.map((m, n) => (
                            <div key={n} className="moment">
                              <code>{m.timestamp}</code>
                              <span>
                                <b>{m.type === "strong_answer" ? t("admin.detail.strongAnswer") : m.type === "hesitation" ? t("admin.detail.hesitation") : t("admin.detail.note")}</b> — {m.note}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {i.transcript && (
                        <details className="text-sm">
                          <summary className="cursor-pointer font-semibold">{t("admin.detail.transcript")}</summary>
                          <p className="mt-2 whitespace-pre-wrap">{i.transcript}</p>
                        </details>
                      )}
                      <p className="hint">{t("admin.detail.voiceHint")}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {canManage && app.status !== "incomplete" && <InterviewUpload applicationId={app.id} />}
          </section>

          <section className="card" aria-labelledby="answers-h">
            <h2 id="answers-h" className="sub-title">{t("admin.detail.answers")}</h2>
            {sorted.length === 0 && <p className="hint mt-2">{t("admin.detail.noAnswers")}</p>}
            <dl className="qa">
              {sorted.map((a) => (
                <div key={a.id}>
                  <dt>{a.q!.label}</dt>
                  <dd>
                    {a.q!.type === "voice" ? (
                      <span className="grid gap-2">
                        {audioUrls.get(a.id) && <audio controls src={audioUrls.get(a.id)!} className="w-full" />}
                        <span>
                          {a.clean_transcript ||
                            (a.transcript_status === "failed" ? t("admin.detail.transcriptionFailed") : t("admin.detail.transcriptionPending"))}
                        </span>
                        {a.raw_transcript && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted">{t("admin.detail.rawTranscript")}</summary>
                            <span className="whitespace-pre-wrap">{a.raw_transcript}</span>
                          </details>
                        )}
                      </span>
                    ) : a.q!.type === "url" ? (
                      <a href={answerText(a.value)} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline">
                        {answerText(a.value)}
                      </a>
                    ) : (
                      answerText(a.value)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card grid gap-3" aria-labelledby="cv-h">
            <div className="flex items-center gap-3">
              <h2 id="cv-h" className="sub-title flex-1">{t("admin.detail.cv")}</h2>
              {cvUrl && (
                <a href={cvUrl} className="btn">
                  <IconDownload /> {t("admin.detail.download")}
                </a>
              )}
            </div>
            {!resume && <p className="hint">{t("admin.detail.noCv")}</p>}
            {resume?.parse_status === "failed" && <p className="hint">{t("admin.detail.cvUnreadable")}</p>}
            {resume?.parse_status === "pending" && <p className="hint">{t("admin.detail.cvPending")}</p>}
            {parsed && (
              <div className="grid gap-3 text-sm">
                {parsed.work_experience?.map((w, i) => (
                  <p key={i}>
                    {t("admin.detail.roleAt", { role: w.role ?? t("admin.detail.roleFallback"), company: w.company ?? "?" })} <span className="text-muted">({w.start ?? "?"} – {w.end ?? "?"})</span>
                  </p>
                ))}
                {parsed.education?.map((e, i) => (
                  <p key={i}>
                    {e.degree} {e.field && `in ${e.field}`} — {e.institution} {e.end && <span className="text-muted">({e.end})</span>}
                  </p>
                ))}
                <Tags items={parsed.skills} />
                <Tags items={parsed.tools} />
                {parsed.certifications && parsed.certifications.length > 0 && <p><b>{t("admin.detail.certifications")}</b> {parsed.certifications.join(", ")}</p>}
                {parsed.languages && parsed.languages.length > 0 && <p><b>{t("admin.detail.languages")}</b> {parsed.languages.join(", ")}</p>}
              </div>
            )}
          </section>

          {(profiles ?? []).length > 0 && (
            <section className="card grid gap-3" aria-labelledby="ext-h">
              <h2 id="ext-h" className="sub-title">{t("admin.detail.external")}</h2>
              {profiles?.map((p) => {
                const d = p.parsed_data as { status?: string; message?: string; data?: unknown } | null;
                return (
                  <div key={p.id} className="text-sm">
                    <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline">
                      {p.type}: {p.url}
                    </a>
                    {d?.status === "unavailable" && <p className="hint">{d.message}</p>}
                    {d?.status === "failed" && <p className="hint">{t("admin.detail.profileFailed")}</p>}
                    {!d && <p className="hint">{t("admin.detail.profilePending")}</p>}
                    {d?.status === "done" && (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-xs">
                        {JSON.stringify(d.data, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <div className="stack sticky-col">
          <section className="card grid gap-4" aria-labelledby="ai-h">
            <div className="flex items-center gap-3">
              <h2 id="ai-h" className="sub-title flex-1">{t("admin.detail.aiEvaluation")}</h2>
            </div>
            {ai?.status === "pending" && <p className="hint">{t("admin.detail.aiRunning")}</p>}
            {ai?.status === "failed" && <p className="error-text">{t("admin.detail.aiFailed")}</p>}
            {!ai && <p className="hint">{t("admin.detail.notEvaluated")}</p>}
            {ai?.status === "done" && (
              <div className="grid gap-4">
                {ai.sub_scores && (
                  <div>
                    {Object.entries(ai.sub_scores as Record<string, number | null>).map(([k, v]) => (
                      <div key={k} className="sub">
                        <span>{["skills", "experience", "assignment", "communication"].includes(k) ? t(`admin.jobForm.${k}` as MessageKey) : k}</span>
                        <div className="bar"><i style={{ width: `${v ?? 0}%`, opacity: v == null ? 0.2 : 1 }} /></div>
                        <b>{v ?? "n/a"}</b>
                      </div>
                    ))}
                  </div>
                )}
                <AiList title={t("admin.detail.keyStrengths")} items={ai.strengths} />
                <AiList title={t("admin.detail.keyWeaknesses")} items={ai.weaknesses} warn />
                <AiList title={t("admin.detail.missing")} items={ai.missing_requirements} warn />
                {interviewComment && <p className="text-sm"><b>{t("admin.detail.interviewLabel")}</b> {interviewComment}</p>}
                {ai.assignment_comment && <p className="text-sm"><b>{t("admin.detail.assignmentLabel")}</b> {ai.assignment_comment}</p>}
                <AiList title={t("admin.detail.suggestedQuestions")} items={ai.interview_questions} />
                <p className="hint">{t("admin.detail.aiHint")}</p>
              </div>
            )}
            {canManage && app.status !== "incomplete" && <RecalculateButton applicationId={app.id} />}
          </section>

          <section className="card grid gap-4" aria-labelledby="hr-h">
            <h2 id="hr-h" className="sub-title">{t("admin.detail.hrEvaluation")}</h2>
            <HrEvaluationForm applicationId={app.id} initial={hr} />
            {canManage && app.status !== "incomplete" && (
              <DecisionEmailButton
                applicationId={app.id}
                decision={hr?.hr_decision ?? null}
                email={app.email}
                sentOn={
                  app.decision_email_sent_at
                    ? new Date(app.decision_email_sent_at).toLocaleDateString(formatLocale(locale))
                    : null
                }
              />
            )}
          </section>

          <AiInterviewSection applicationId={app.id} applicationStatus={app.status} canManage={canManage} localeTag={formatLocale(locale)} />

          <LiveInterviewSection applicationId={app.id} applicationStatus={app.status} canManage={canManage} localeTag={formatLocale(locale)} />

          {app.status !== "incomplete" && (
            <section className="card grid gap-4" aria-labelledby="fb-h">
              <div>
                <h2 id="fb-h" className="sub-title">{t("fb.title")}</h2>
                <p className="hint mt-1">{t("fb.hint")}</p>
              </div>
              <Feedback applicationId={app.id} userId={user.id} rows={feedback} />
            </section>
          )}

          <section className="card grid gap-4" aria-labelledby="chat-h">
            <div>
              <h2 id="chat-h" className="sub-title">{t("hr1.chat.title")}</h2>
              <p className="hint mt-1">{t("rt.cand.hint")}</p>
            </div>
            <div>
              <Link href={`/admin/messages?c=${app.id}`} className="btn btn-primary">
                {t("rt.cand.open")}
                {(unreadMsgs ?? 0) > 0 ? ` (${unreadMsgs})` : ""}
              </Link>
            </div>
            {canManage && <RenewLink applicationId={app.id} />}
          </section>

          <section className="card grid gap-4" aria-labelledby="notes-h">
            <div>
              <h2 id="notes-h" className="sub-title">{t("admin.notes.title")}</h2>
              <p className="hint mt-1">{t("admin.notes.hint")}</p>
            </div>
            <Notes applicationId={app.id} notes={notes} userId={user.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
