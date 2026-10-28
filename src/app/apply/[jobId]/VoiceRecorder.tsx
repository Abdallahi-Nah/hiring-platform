"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconMic, IconStop } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import type { QuestionRow } from "@/lib/jobs/schema";

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

type Props = {
  jobId: string;
  question: QuestionRow;
  done: boolean;
  error?: string;
  onBusy: (busy: boolean) => void;
  onDone: () => void;
};

function pickMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return options.find((t) => MediaRecorder.isTypeSupported(t));
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VoiceRecorder({ jobId, question: q, done, error, onBusy, onDone }: Props) {
  const t = useT();
  const [exists, setExists] = useState(false);
  const maxSeconds = q.config.max_seconds ?? 180;
  const [phase, setPhase] = useState<Phase>(done ? "done" : "idle");
  const [revealed, setRevealed] = useState(false);
  const [remaining, setRemaining] = useState(maxSeconds);
  const [message, setMessage] = useState("");

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discard = useRef(false);

  const onBusyRef = useRef(onBusy);
  useEffect(() => {
    onBusyRef.current = onBusy;
  });
  useEffect(() => {
    onBusyRef.current(phase === "recording" || phase === "uploading");
  }, [phase]);

  // Si le candidat quitte la page pendant l'enregistrement, l'audio est jeté.
  useEffect(() => {
    const abort = () => {
      discard.current = true;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("pagehide", abort);
    return () => {
      window.removeEventListener("pagehide", abort);
      abort();
    };
  }, []);

  async function upload(blob: Blob) {
    setPhase("uploading");
    const body = new FormData();
    body.append("questionId", q.id);
    body.append("audio", blob, "answer");
    try {
      const res = await fetch(`/api/apply/${jobId}/voice`, { method: "POST", body });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw Object.assign(new Error(json?.error ?? t("apply.voice.uploadFailed")), { code: json?.code as string | undefined });
      }
      setPhase("done");
      onDone();
    } catch (e) {
      setExists((e as { code?: string }).code === "exists");
      setMessage(e instanceof Error ? e.message : t("apply.voice.uploadFailed"));
      setPhase("error");
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    setMessage("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setMessage(t("apply.voice.unsupported"));
      return setPhase("error");
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage(t("apply.voice.denied"));
      return setPhase("error");
    }

    const mimeType = pickMimeType();
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream.current, {
      mimeType,
      audioBitsPerSecond: 32000,
    });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      if (discard.current) return;
      upload(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
    };
    recorder.current = rec;
    discard.current = false;

    // L'enregistrement démarre avant que la question soit visible.
    rec.start(1000);
    setRemaining(maxSeconds);
    setPhase("recording");
    const endsAt = Date.now() + maxSeconds * 1000;
    timer.current = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) stop();
    }, 500);
  }

  const WAVE = [10, 22, 34, 16, 40, 28, 12, 36, 24, 38, 14, 30, 20, 42, 18, 32, 26, 12, 36, 22, 40, 16, 28, 34, 12, 24, 38, 20, 30, 14];
  const showLabel = revealed || phase === "done" || phase === "uploading";

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="sub-title">
          {t("apply.voice.title")}
          {q.required && <span className="text-bad"> *</span>}
        </h2>
        {phase === "idle" && <p className="hint mt-1">{t("apply.voice.intro", { max: fmt(maxSeconds) })}</p>}
      </div>

      {phase === "idle" && (
        <div className="rec">
          <div className="timer timer-idle" style={{ "--v": 0 } as CSSProperties}>
            <div dir="ltr">
              {fmt(maxSeconds)}
              <small className="!text-muted">{t("apply.voice.ready")}</small>
            </div>
          </div>
          <button type="button" onClick={start} className="btn btn-primary btn-lg btn-block">
            <IconMic /> {t("apply.voice.start")}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="rec" aria-live="polite">
          <div className="timer" style={{ "--v": Math.round((remaining / maxSeconds) * 100) } as CSSProperties}>
            <div dir="ltr">
              {fmt(remaining)}
              <small>
                <span className="dot" /> {t("apply.voice.recording")}
              </small>
            </div>
          </div>
          <div className="wave" aria-hidden>
            {WAVE.map((h, n) => (
              <i key={n} style={{ height: h }} />
            ))}
          </div>
          {!revealed ? (
            <button type="button" onClick={() => setRevealed(true)} className="btn btn-block my-3.5">
              {t("apply.voice.showQuestion")}
            </button>
          ) : (
            <p className="q-reveal">{q.label}</p>
          )}
          <button type="button" onClick={stop} className="btn btn-primary btn-lg btn-block">
            <IconStop /> {t("apply.voice.stop")}
          </button>
        </div>
      )}

      {showLabel && phase !== "recording" && <p className="q-reveal">{q.label}</p>}
      {phase === "uploading" && <p className="hint">{t("apply.voice.sending")}</p>}
      {phase === "done" && (
        <p className="chip chip-good w-fit" role="status">
          {t("apply.voice.recorded")}
        </p>
      )}
      {phase === "error" && (
        <div className="grid gap-2">
          <p className="error-text" role="alert">
            {message} {exists ? "" : t("apply.voice.pleaseTryAgain")}
          </p>
          {!exists && (
            <button type="button" onClick={start} className="btn w-fit">
              {t("apply.voice.tryAgain")}
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
