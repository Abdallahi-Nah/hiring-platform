"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { AUDIO_BITS_PER_SECOND, MAX_ANSWER_SECONDS, MIN_ANSWER_SECONDS, PREP_SECONDS, VIDEO_BITS_PER_SECOND } from "@/lib/ai/interview-config";
import { createClient } from "@/lib/supabase/client";

type Stage = "intro" | "check" | "prep" | "record" | "upload" | "done";

const API_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 150_000;

// Erreur définitive (réponse 4xx du serveur) : inutile de réessayer.
class ApiError extends Error {}

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => (clearTimeout(id), resolve(v)),
      (e) => (clearTimeout(id), reject(e))
    );
  });

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let k = 0; k < tries; k++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof ApiError) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
    }
  }
  throw last;
}

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
  const pending = useRef<{ blob: Blob; seconds: number; stored: boolean } | null>(null);
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
    const rec = new MediaRecorder(s, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: VIDEO_BITS_PER_SECOND, audioBitsPerSecond: AUDIO_BITS_PER_SECOND });
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      pending.current = { blob: new Blob(chunks.current, { type: rec.mimeType || mime || "video/webm" }), seconds: secondsRef.current, stored: false };
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

  // Envoi en 3 temps (Vercel refuse les requêtes de plus de 4,5 Mo) :
  // 1) lien d'envoi signé, 2) vidéo envoyée directement à Supabase Storage, 3) confirmation de la réponse.
  // Chaque étape a un délai maximum et 3 essais : sur un réseau faible, la page ne reste jamais bloquée.
  async function upload() {
    const p = pending.current;
    if (!p) return;
    setStage("upload");
    setError("");
    try {
      const i = indexRef.current;
      const type = p.blob.type.split(";")[0] || "video/webm";
      let already = false;
      if (!p.stored) {
        const r1 = await callApi(`/api/interview/${token}/upload-url`, { index: i, type });
        if (r1.status === 409 && r1.json.code === "exists") already = true;
        else {
          if (!r1.ok) throw new ApiError(r1.json.error || t("ivid.room.errNetwork"));
          await withRetry(async () => {
            const { error: upErr } = await withTimeout(createClient().storage.from("ai-interviews").uploadToSignedUrl(r1.json.path ?? "", r1.json.token ?? "", p.blob, { contentType: type }), UPLOAD_TIMEOUT_MS);
            if (upErr) throw new Error("upload");
          });
          p.stored = true;
        }
      }
      if (!already) {
        const r2 = await callApi(`/api/interview/${token}/answer`, { index: i, seconds: p.seconds, type });
        if (!r2.ok && r2.json.code !== "exists") throw new ApiError(r2.json.error || t("ivid.room.errNetwork"));
      }
      done.current.add(i);
      pending.current = null;
      const next = questions.findIndex((_, k) => !done.current.has(k));
      if (next === -1) await finish();
      else goPrep(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ivid.room.errNetwork"));
    }
  }

  // Appel JSON : 3 essais si le réseau coupe ou si le serveur répond 5xx ; une réponse 4xx est définitive.
  async function callApi(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: { error?: string; code?: string; path?: string; token?: string } }> {
    return withRetry(async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
        const json = await res.json().catch(() => ({}));
        if (res.status >= 500) throw new Error("server");
        return { ok: res.ok, status: res.status, json };
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async function finish() {
    setStage("upload");
    setError("");
    try {
      const res = await callApi(`/api/interview/${token}/finish`, {});
      if (!res.ok) throw new ApiError(res.json.error || t("ivid.room.errNetwork"));
      stream.current?.getTracks().forEach((tr) => tr.stop());
      setStage("done");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("ivid.room.errNetwork"));
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
