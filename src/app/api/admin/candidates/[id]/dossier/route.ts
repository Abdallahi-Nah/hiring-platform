import { getI18n } from "@/i18n/server";
import { decisionLabel, recommendationLabel, statusLabel } from "@/i18n/labels";
import { formatLocale, isRtl } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { answerText } from "@/lib/candidates";
import { buildDossierPdf, type Block } from "@/lib/dossier-pdf";
import { createClient } from "@/lib/supabase/server";
import { UUID } from "@/lib/uuid";

const json = (error: string, status: number) => Response.json({ error }, { status });
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : answerText(x))).filter(Boolean) : []);
const score = (n: unknown) => (typeof n === "number" ? `${Math.round(n)}%` : "—");

// Dossier complet d'un candidat en PDF. Lecture avec le compte de l'utilisateur : les règles RLS s'appliquent
// (un Reviewer ne reçoit jamais le salaire, et personne ne voit un candidat d'une autre entreprise).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json("Not signed in.", 401);
  const { id } = await params;
  if (!UUID.test(id)) return json("Invalid candidate.", 400);
  const { t, locale } = await getI18n();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id, status, email, phone, submitted_at, job_forms(title, companies(name))")
    .eq("id", id)
    .single();
  if (!app) return json("Candidate not found.", 404);

  const [{ data: answers }, { data: ai }, { data: hr }, { data: aiIv }, { data: live }, { data: fb }] = await Promise.all([
    supabase.from("answers").select("value, clean_transcript, questions(label, type, page_number, position, config)").eq("application_id", id),
    supabase.from("ai_evaluations").select("status, score, rank, recommendation, strengths, weaknesses, missing_requirements").eq("application_id", id).maybeSingle(),
    supabase.from("hr_evaluations").select("hr_score, hr_decision, hr_notes").eq("application_id", id).maybeSingle(),
    supabase.from("ai_interviews").select("id, status, score, evaluation, questions").eq("application_id", id).maybeSingle(),
    supabase.from("live_interviews").select("status, scheduled_at, duration_minutes").eq("application_id", id).maybeSingle(),
    supabase.from("interview_feedback").select("author_name, communication, technical, motivation, culture, comment").eq("application_id", id).order("updated_at"),
  ]);
  const { data: ivAnswers } = aiIv ? await supabase.from("ai_interview_answers").select("question_index, score").eq("interview_id", aiIv.id).order("question_index") : { data: [] };

  const job = app.job_forms as unknown as { title: string; companies: { name: string } | null } | null;
  type Q = { label: string; page_number: number; position: number; config: { identity?: string } | null };
  const sorted = (answers ?? [])
    .map((a) => ({ value: answerText(a.value) || (a.clean_transcript ?? ""), q: a.questions as unknown as Q | null }))
    .filter((a) => a.q && a.value)
    .sort((a, b) => a.q!.page_number - b.q!.page_number || a.q!.position - b.q!.position);
  const name = sorted.find((a) => a.q!.config?.identity === "name")?.value || app.email || t("admin.detail.candidateFallback");
  const fmt = (d: string) => new Date(d).toLocaleString(formatLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  const blocks: Block[] = [
    { kind: "title", text: name, sub: `${job?.title ?? ""}${job?.companies?.name ? ` · ${job.companies.name}` : ""}` },
    { kind: "line", label: t("dossier.status"), text: statusLabel(t, app.status) },
    ...(app.email ? [{ kind: "line" as const, label: t("dossier.email"), text: app.email }] : []),
    ...(app.phone ? [{ kind: "line" as const, label: t("dossier.phone"), text: app.phone }] : []),
    ...(app.submitted_at ? [{ kind: "line" as const, label: t("dossier.submitted"), text: fmt(app.submitted_at) }] : []),
  ];

  if (ai?.status === "done") {
    blocks.push({ kind: "section", text: t("dossier.ai") });
    blocks.push({ kind: "line", label: t("dossier.score"), text: `${score(ai.score)}${ai.rank != null ? ` · ${t("admin.candidates.rankN", { n: ai.rank })}` : ""}` });
    if (ai.recommendation) blocks.push({ kind: "line", label: t("dossier.recommendation"), text: recommendationLabel(t, ai.recommendation) });
    for (const [k, items] of [["admin.detail.keyStrengths", asList(ai.strengths)], ["admin.detail.keyWeaknesses", asList(ai.weaknesses)], ["admin.detail.missing", asList(ai.missing_requirements)]] as const) {
      if (items.length) blocks.push({ kind: "list", label: t(k), items });
    }
  }

  if (aiIv && aiIv.status === "completed") {
    const ev = (aiIv.evaluation ?? {}) as { summary?: string; strengths?: string[]; weaknesses?: string[]; recommendation?: string | null };
    const questions = ((aiIv.questions as { text: string }[]) ?? []).map((q) => q.text);
    blocks.push({ kind: "section", text: t("dossier.aiVideo") });
    blocks.push({ kind: "line", label: t("dossier.score"), text: `${score(aiIv.score)}${ev.recommendation ? ` · ${recommendationLabel(t, ev.recommendation)}` : ""}` });
    if (ev.summary) blocks.push({ kind: "line", text: ev.summary });
    if (asList(ev.strengths).length) blocks.push({ kind: "list", label: t("admin.detail.keyStrengths"), items: asList(ev.strengths) });
    if (asList(ev.weaknesses).length) blocks.push({ kind: "list", label: t("admin.detail.keyWeaknesses"), items: asList(ev.weaknesses) });
    const perQ = (ivAnswers ?? []).map((a) => `${questions[a.question_index] ?? t("ivid.hr.questionN", { n: a.question_index + 1 })} — ${score(a.score)}`);
    if (perQ.length) blocks.push({ kind: "list", label: t("dossier.perQuestion"), items: perQ });
  }

  if (live) {
    blocks.push({ kind: "section", text: t("dossier.live") });
    blocks.push({ kind: "line", text: `${fmt(live.scheduled_at)} (UTC) · ${t("live.hr.minutes", { n: live.duration_minutes })} · ${t(`live.hr.status.${live.status}` as "live.hr.status.scheduled")}` });
  }

  if ((fb ?? []).length) {
    blocks.push({ kind: "section", text: t("fb.title") });
    for (const f of fb ?? []) {
      blocks.push({ kind: "line", label: f.author_name, text: `${t("fb.communication")} ${f.communication}/5 · ${t("fb.technical")} ${f.technical}/5 · ${t("fb.motivation")} ${f.motivation}/5 · ${t("fb.culture")} ${f.culture}/5${f.comment ? `\n${f.comment}` : ""}` });
    }
  }

  if (hr && (hr.hr_decision || hr.hr_score != null || hr.hr_notes)) {
    blocks.push({ kind: "section", text: t("dossier.hr") });
    if (hr.hr_decision) blocks.push({ kind: "line", label: t("dossier.decision"), text: decisionLabel(t, hr.hr_decision) });
    if (hr.hr_score != null) blocks.push({ kind: "line", label: t("dossier.hrScore"), text: score(hr.hr_score) });
    if (hr.hr_notes) blocks.push({ kind: "line", label: t("dossier.notes"), text: hr.hr_notes });
  }

  if (sorted.length) {
    blocks.push({ kind: "section", text: t("dossier.answers") });
    for (const a of sorted) blocks.push({ kind: "line", label: a.q!.label, text: a.value });
  }

  const pdf = await buildDossierPdf(blocks, isRtl(locale), `${t("dossier.confidential")} · ${new Date().toISOString().slice(0, 10)}`);
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "candidate";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dossier-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
