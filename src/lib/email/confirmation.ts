import { isRtl, type Locale } from "@/i18n/config";
import { makeT } from "@/i18n/server";
import type { TFunction } from "@/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, oneLine, sendMail } from "./transport";

const TRANSCRIPT_WAIT_MS = 15000;

type Line = { label: string; value: string };

function formatValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (v == null) return "";
  return String(v);
}

// Attend un peu que les transcriptions vocales soient prêtes.
async function waitForTranscripts(applicationId: string) {
  const db = createAdminClient();
  const deadline = Date.now() + TRANSCRIPT_WAIT_MS;
  while (Date.now() < deadline) {
    const { count } = await db
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("application_id", applicationId)
      .eq("transcript_status", "pending");
    if (!count) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function collectLines(applicationId: string, jobId: string, t: TFunction): Promise<Line[]> {
  const db = createAdminClient();
  const [{ data: questions }, { data: answers }, { data: resume }] = await Promise.all([
    db
      .from("questions")
      .select("id, type, label, page_number, position")
      .eq("job_form_id", jobId)
      .order("page_number")
      .order("position"),
    db
      .from("answers")
      .select("question_id, value, clean_transcript, raw_transcript, audio_url")
      .eq("application_id", applicationId),
    db.from("resumes").select("file_url").eq("application_id", applicationId).maybeSingle(),
  ]);

  const byQuestion = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const lines: Line[] = [];
  for (const q of questions ?? []) {
    if (q.type === "file_upload") {
      if (resume) lines.push({ label: q.label, value: t("email.cvUploaded") });
      continue;
    }
    const a = byQuestion.get(q.id);
    if (!a) continue;
    if (q.type === "voice") {
      const text = a.clean_transcript || a.raw_transcript;
      lines.push({ label: q.label, value: text ? text : t("email.voiceRecorded") });
      continue;
    }
    const value = formatValue(a.value);
    if (value) lines.push({ label: q.label, value });
  }
  return lines;
}

function render(title: string, lines: Line[], t: TFunction, locale: Locale, trackLink: string) {
  const text = [
    t("email.thanks"),
    `${t("email.received")} ${title}`,
    "",
    t("email.copy"),
    "",
    `${t("email1.trackLine")} ${trackLink}`,
    "",
    ...lines.map((l) => `${l.label}\n${l.value}\n`),
  ].join("\n");

  // Arabe : le message s'affiche de droite à gauche.
  const dir = isRtl(locale) ? "rtl" : "ltr";
  const html = `<div dir="${dir}" lang="${locale}" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;text-align:${dir === "rtl" ? "right" : "left"}">
<h2>${escapeHtml(t("email.thanks"))}</h2>
<p>${escapeHtml(t("email.received"))} <strong>${escapeHtml(title)}</strong></p>
<p>${escapeHtml(t("email.copy"))}</p>
<p><a href="${escapeHtml(trackLink)}">${escapeHtml(t("email1.trackLine"))}</a></p>
${lines
  .map(
    (l) =>
      `<p style="margin:12px 0 0"><strong>${escapeHtml(l.label)}</strong></p><p style="margin:4px 0;white-space:pre-wrap">${escapeHtml(l.value)}</p>`
  )
  .join("\n")}
</div>`;
  return { html, text };
}

// Envoie l'email de confirmation (une seule fois). N'inclut jamais de score IA.
export async function sendConfirmationEmail(applicationId: string, locale: Locale = "en", baseUrl = "") {
  const t = makeT(locale);
  const db = createAdminClient();

  // On "réserve" l'envoi : un seul appel peut réussir.
  const { data: claimed } = await db
    .from("applications")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("status", "submitted")
    .is("confirmation_sent_at", null)
    .select("email, job_form_id, track_token")
    .single();
  if (!claimed?.email) return;

  try {
    await waitForTranscripts(applicationId);
    const { data: job } = await db
      .from("job_forms")
      .select("title, companies(name)")
      .eq("id", claimed.job_form_id)
      .single();
    const title = oneLine(job?.title ?? t("email.fallbackJob"));
    const lines = await collectLines(applicationId, claimed.job_form_id, t);
    const { html, text } = render(title, lines, t, locale, `${baseUrl}/track/${claimed.track_token}`);

    await sendMail({
      to: claimed.email,
      fromName: (job?.companies as unknown as { name: string } | null)?.name,
      subject: t("email.subject", { job: title }),
      html,
      text,
    });
  } catch (e) {
    console.error("sendConfirmationEmail", applicationId, e);
    // Permet un nouvel essai plus tard.
    await db.from("applications").update({ confirmation_sent_at: null }).eq("id", applicationId);
  }
}
