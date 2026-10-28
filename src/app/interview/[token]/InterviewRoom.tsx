"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { MAX_ANSWER_SECONDS, MIN_ANSWER_SECONDS, PREP_SECONDS } from "@/lib/ai/interview-config";

type Stage = "intro" | "check" | "prep" | "record" | "upload" | "done";

const pickMime = () => ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));

// Salle d'entretien : les questions s'affichent une par une ; chaque réponse est enregistrée puis envoyée (une seule tentative).
export function InterviewRoom({ token, questions, answered, speechLang, months }: { token: string; questions: string[]; answered: number[]; speechLang: string; months: number }) {
  const t = useT();
  const total = questions.length;
  const [stage, setStage] = useState<Stage>("intro");
  const [consent, setConsent] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, questions.findIndex((_, i) => !answered.includes(i))));
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const pending = useRef<{ blob: Blob; seconds: number } | null>(null);
  const done = useRef(new Set(answered));
  const indexRef = useRef(index);
  const secondsRef = useRef(0);
  const startRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    indexRef.current = index;
    secondsRef.current = seconds;
  });

  // Aperçu de la caméra (miroir) dès qu'elle est visible.
  useEffect(() => {
    if (video.current && stream.current && ["check", "prep", "record"].includes(stage)) video.current.srcObject = stream.current;
  }, [stage]);

  // Coupe la caméra en quittant la page.
  useEffect(() => {
    return () => {
      stream.current?.getTracks().forEach((tr) => tr.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Niveau du micro pendant le test.
  useEffect(() => {
    if (stage !== "check" || !stream.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream.current).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const id = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 64));
    }, 100);
    return () => {
      clearInterval(id);
      void ctx.close();
    };
  }, [stage]);

  // Compte à rebours (préparation) ou chronomètre (enregistrement).
  useEffect(() => {
    if (stage !== "prep" && stage !== "record") return;
    const id = setInterval(() => setSeconds((s) => (stage === "prep" ? s - 1 : s + 1)), 1000);
    return () => clearInterval(id);
  }, [stage]);
  useEffect(() => {
    if (stage === "prep" && seconds <= 0) startRef.current();
    if (stage === "record" && seconds >= MAX_ANSWER_SECONDS) stopRef.current();
  }, [stage, seconds]);

  async function enableCamera() {
    setError("");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setError(t("ivid.room.errSupport"));
    setBusy(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setStage("check");
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? t("ivid.room.errPermission") : t("ivid.room.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function goPrep(i: number) {
    window.speechSynthesis?.cancel();
    setIndex(i);
    setSeconds(PREP_SECONDS);
    setError("");
    setStage("prep");
  }

  function begin() {
    const first = questions.findIndex((_, i) => !done.current.has(i));
    if (first === -1) void finish();
    else goPrep(first);
  }

  function startRecording() {
    const s = stream.current;
    if (!s || recorder.current?.state === "recording") return;
    window.speechSynthesis?.cancel();
    const mime = pickMime();
    const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 600_000, audioBitsPerSecond: 64_000 });
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      pending.current = { blob: new Blob(chunks.current, { type: rec.mimeType || mime || "video/webm" }), seconds: secondsRef.current };
      void upload();
    };
    rec.start(1000);
    recorder.current = rec;
    setSeconds(0);
    setStage("record");
  }
  startRef.current = startRecording;

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  stopRef.current = stopRecording;

  async function upload() {
    const p = pending.current;
    if (!p) return;
    setStage("upload");
    setError("");
    try {
      const form = new FormData();
      form.append("file", p.blob, "answer.webm");
      form.append("index", String(indexRef.current));
      form.append("seconds", String(p.seconds));
      const res = await fetch(`/api/interview/${token}/answer`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok && json.code !== "exists") throw new Error(json.error || t("ivid.room.errGeneric"));
      done.current.add(indexRef.current);
      pending.current = null;
      const next = questions.findIndex((_, i) => !done.current.has(i));
      if (next === -1) await finish();
      else goPrep(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ivid.room.errGeneric"));
    }
  }

  async function finish() {
    setStage("upload");
    setError("");
    try {
      const res = await fetch(`/api/interview/${token}/finish`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || t("ivid.room.errGeneric"));
      stream.current?.getTracks().forEach((tr) => tr.stop());
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ivid.room.errGeneric"));
    }
  }

  function speak() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(questions[index]);
    u.lang = speechLang;
    window.speechSynthesis.speak(u);
  }

  const preview = (
    <video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" style={{ transform: "scaleX(-1)" }} aria-label={t("ivid.room.preview")} />
  );
  const questionBlock = (
    <div className="grid gap-2">
      <p className="hint font-semibold">{t("ivid.room.question", { n: index + 1, total })}</p>
      <p className="text-lg font-semibold" dir="auto">{questions[index]}</p>
    </div>
  );

  if (stage === "done") {
    return (
      <div className="card grid gap-2 text-center" role="status">
        <h2 className="sub-title text-good">{t("ivid.room.doneTitle")}</h2>
        <p className="hint">{t("ivid.room.doneText")}</p>
      </div>
    );
  }

  return (
    <div className="card grid gap-4">
      {stage === "intro" && (
        <>
          <h2 className="sub-title">{t("ivid.room.howTitle")}</h2>
          <ul className="grid list-disc gap-1.5 ps-5 text-sm">
            <li>{t("ivid.room.how1", { count: total })}</li>
            <li>{t("ivid.room.how2", { prep: PREP_SECONDS, max: MAX_ANSWER_SECONDS })}</li>
            <li>{t("ivid.room.how3")}</li>
            <li>{t("ivid.room.how4")}</li>
            <li>{t("ivid.room.how5")}</li>
            <li>{t("ivid.room.how6", { months })}</li>
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{t("ivid.room.consent")}</span>
          </label>
          <button type="button" disabled={!consent || busy} onClick={enableCamera} className="btn btn-primary btn-lg btn-block">
            {busy ? t("admin.common.saving") : t("ivid.room.start")}
          </button>
        </>
      )}

      {stage === "check" && (
        <>
          <h2 className="sub-title">{t("ivid.room.checkTitle")}</h2>
          {preview}
          <div className="grid gap-1">
            <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} aria-label={t("ivid.room.mic")}>
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <p className="hint">{t("ivid.room.checkHint")}</p>
          </div>
          <button type="button" onClick={begin} className="btn btn-primary btn-lg btn-block">{t("ivid.room.begin")}</button>
        </>
      )}

      {stage === "prep" && (
        <>
          {questionBlock}
          {preview}
          <p className="text-center font-semibold tabular-nums" role="timer">{t("ivid.room.prepLeft", { s: Math.max(0, seconds) })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startRecording} className="btn btn-primary btn-lg flex-1">{t("ivid.room.ready")}</button>
            <button type="button" onClick={speak} className="btn">{t("ivid.room.listen")}</button>
          </div>
        </>
      )}

      {stage === "record" && (
        <>
          {questionBlock}
          {preview}
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-semibold text-bad"><span className="dot" aria-hidden />{t("ivid.room.recording")}</span>
            <span className="font-semibold tabular-nums" role="timer">{t("ivid.room.elapsed", { s: seconds, max: MAX_ANSWER_SECONDS })}</span>
          </div>
          <div className="bar" aria-hidden><div className="h-full rounded-full bg-bad" style={{ width: `${Math.min(100, (seconds / MAX_ANSWER_SECONDS) * 100)}%` }} /></div>
          <button type="button" disabled={seconds < MIN_ANSWER_SECONDS} onClick={stopRecording} className="btn btn-primary btn-lg btn-block">{t("ivid.room.stop")}</button>
          {seconds < MIN_ANSWER_SECONDS && <p className="hint text-center">{t("ivid.room.tooShort", { min: MIN_ANSWER_SECONDS })}</p>}
        </>
      )}

      {stage === "upload" && (
        <div className="grid gap-3 text-center" role="status">
          <p className="font-semibold">{error ? "" : t("ivid.room.sending")}</p>
          {error && (
            <>
              <p className="error-text" role="alert">{error}</p>
              <button type="button" className="btn btn-primary mx-auto" onClick={() => (pending.current ? void upload() : void finish())}>{t("ivid.room.retry")}</button>
            </>
          )}
        </div>
      )}

      {error && stage !== "upload" && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
