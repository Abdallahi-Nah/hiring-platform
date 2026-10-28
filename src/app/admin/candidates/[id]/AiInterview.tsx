import { Chip } from "@/components/ui/Chip";
import { ScoreBar } from "@/components/ui/Score";
import { recommendationLabel } from "@/i18n/labels";
import { getI18n } from "@/i18n/server";
import { hasSpeech } from "@/lib/ai/interview-config";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AutoRefresh } from "./AutoRefresh";
import { CreateInterview, InterviewActions, QuestionsEditor } from "./AiInterviewControls";

const SIGNED_URL_SECONDS = 300;
type Evaluation = { summary?: string; strengths?: string[]; weaknesses?: string[]; recommendation?: string | null; no_speech?: boolean };
type AnswerEval = { relevance: number | null; clarity: number | null; structure: number | null; depth: number | null; comment?: string };

const isPast = (d?: string | null) => !!d && new Date(d) < new Date();

// Section "Entretien vidéo IA" de la fiche candidat : questions, lien, vidéos, transcriptions et évaluation.
export async function AiInterviewSection({ applicationId, applicationStatus, canManage, localeTag }: { applicationId: string; applicationStatus: string; canManage: boolean; localeTag: string }) {
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: iv } = await supabase
    .from("ai_interviews")
    .select("id, token, status, questions, invited_at, expires_at, completed_at, eval_status, score, evaluation")
    .eq("application_id", applicationId)
    .maybeSingle();

  const header = (
    <div>
      <h2 className="sub-title">{t("ivid.hr.title")}</h2>
      <p className="hint mt-1">{t("ivid.hr.hint")}</p>
    </div>
  );

  if (!iv) {
    return (
      <section className="card grid gap-4" aria-labelledby="aiiv-h">
        <div id="aiiv-h">{header}</div>
        {canManage && applicationStatus !== "incomplete" ? <CreateInterview applicationId={applicationId} /> : <p className="hint">{t("ivid.hr.none")}</p>}
      </section>
    );
  }

  const questions = ((iv.questions as { text: string }[]) ?? []).map((q) => q.text);
  const { data: rows } = await supabase
    .from("ai_interview_answers")
    .select("id, question_index, video_path, duration_seconds, transcript, transcript_status, score, evaluation")
    .eq("interview_id", iv.id)
    .order("question_index");
  const answers = rows ?? [];
  const admin = createAdminClient();
  const urls = new Map<number, string | null>();
  for (const a of answers) urls.set(a.question_index, (await admin.storage.from("ai-interviews").createSignedUrl(a.video_path, SIGNED_URL_SECONDS)).data?.signedUrl ?? null);

  const ev = (iv.evaluation as Evaluation | null) ?? null;
  const expired = iv.status !== "completed" && isPast(iv.expires_at);
  const processing = iv.eval_status === "pending" || answers.some((a) => a.transcript_status === "pending");
  const statusTone = iv.status === "completed" ? "good" : iv.status === "draft" ? "neutral" : "info";
  const link = canManage && iv.status !== "draft" ? `${await siteUrl()}/interview/${iv.token}` : null;
  const fmt = (d: string) => new Date(d).toLocaleDateString(localeTag, { dateStyle: "medium" });

  return (
    <section className="card grid gap-4" aria-labelledby="aiiv-h">
      {processing && <AutoRefresh />}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div id="aiiv-h">{header}</div>
        <Chip tone={statusTone}>{t(`ivid.hr.status.${iv.status}` as "ivid.hr.status.draft")}</Chip>
      </div>

      {iv.status === "draft" && canManage && <QuestionsEditor interviewId={iv.id} initial={questions} />}
      {iv.status === "draft" && !canManage && <p className="hint">{t("ivid.hr.waiting")}</p>}

      {iv.status !== "draft" && (
        <div className="grid gap-1 text-sm">
          {iv.expires_at && iv.status !== "completed" && <p className={expired ? "error-text" : "hint"}>{expired ? t("ivid.hr.expired") : t("ivid.hr.expires", { date: fmt(iv.expires_at) })}</p>}
          <p className="hint">{t("ivid.hr.progress", { done: answers.length, total: questions.length })}</p>
        </div>
      )}
      {iv.status !== "draft" && canManage && <InterviewActions interviewId={iv.id} link={link} canResend={iv.status !== "completed"} canEvaluate={answers.length > 0 && !processing} />}

      {/* Évaluation globale */}
      {processing && <p className="hint" role="status">{t("ivid.hr.evaluating")}</p>}
      {iv.eval_status === "failed" && <p className="error-text" role="alert">{t("ivid.hr.evalFailed")}</p>}
      {iv.eval_status === "done" && ev?.no_speech && <p className="hint">{t("ivid.hr.noSpeechAll")}</p>}
      {iv.eval_status === "done" && !ev?.no_speech && (
        <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <b>{t("ivid.hr.score")}</b>
            <div className="w-48"><ScoreBar value={iv.score == null ? null : Number(iv.score)} /></div>
          </div>
          {ev?.recommendation && <p><b>{t("ivid.hr.recommendation")}:</b> {recommendationLabel(t, ev.recommendation)}</p>}
          {ev?.summary && <p dir="auto">{ev.summary}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {!!ev?.strengths?.length && (
              <div><b className="text-sm">{t("ivid.hr.strengths")}</b><ul className="mt-1 grid list-disc gap-1 ps-5 text-sm">{ev.strengths.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul></div>
            )}
            {!!ev?.weaknesses?.length && (
              <div><b className="text-sm">{t("ivid.hr.weaknesses")}</b><ul className="mt-1 grid list-disc gap-1 ps-5 text-sm">{ev.weaknesses.map((s, i) => <li key={i} dir="auto">{s}</li>)}</ul></div>
            )}
          </div>
          <p className="hint">{t("ivid.hr.aiNote")}</p>
        </div>
      )}

      {/* Une carte par question : vidéo, transcription, notes */}
      {iv.status !== "draft" && (
        <ol className="grid gap-4">
          {questions.map((q, i) => {
            const a = answers.find((x) => x.question_index === i);
            const e = (a?.evaluation as AnswerEval | null) ?? null;
            const url = a ? urls.get(i) : null;
            return (
              <li key={i} className="grid gap-2 rounded-xl border border-line p-3">
                <p className="font-semibold" dir="auto">{t("ivid.hr.questionN", { n: i + 1 })}: {q}</p>
                {!a && <p className="hint">{t("ivid.hr.noAnswer")}</p>}
                {a && url && <video controls preload="metadata" src={url} className="aspect-video w-full max-w-xl rounded-lg bg-black" />}
                {a && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold">{t("ivid.hr.transcript")}</summary>
                    <p className="mt-1 whitespace-pre-wrap" dir="auto">
                      {a.transcript_status === "pending" ? t("ivid.hr.transcribing") : a.transcript_status === "failed" ? t("ivid.hr.transcriptFailed") : hasSpeech(a.transcript) ? a.transcript!.trim() : t("ivid.hr.noSpeech")}
                    </p>
                  </details>
                )}
                {a && e && (
                  <div className="grid gap-1 text-sm">
                    <div className="grid gap-1.5">
                      {(["relevance", "clarity", "structure", "depth"] as const).map((k) => (
                        <div key={k} className="flex items-center justify-between gap-2"><span>{t(`ivid.hr.${k}` as "ivid.hr.relevance")}</span><div className="w-44"><ScoreBar value={e[k]} /></div></div>
                      ))}
                    </div>
                    {e.comment && <p className="text-muted" dir="auto">{e.comment}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
