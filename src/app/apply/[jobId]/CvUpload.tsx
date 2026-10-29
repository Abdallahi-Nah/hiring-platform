"use client";

import { useEffect, useRef, useState } from "react";
import { IconUpload } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import type { QuestionRow } from "@/lib/jobs/schema";

type Phase = "idle" | "uploading" | "done" | "error";

type Props = {
  jobId: string;
  question: QuestionRow;
  maxMb: number;
  done: boolean;
  error?: string;
  onBusy: (busy: boolean) => void;
  onDone: () => void;
};

const EXTENSIONS = ["pdf", "doc", "docx"];

export function CvUpload({ jobId, question: q, maxMb, done, error, onBusy, onDone }: Props) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>(done ? "done" : "idle");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");

  const onBusyRef = useRef(onBusy);
  useEffect(() => {
    onBusyRef.current = onBusy;
  });
  useEffect(() => {
    onBusyRef.current(phase === "uploading");
  }, [phase]);

  async function upload(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTENSIONS.includes(ext)) {
      setMessage(t("apply.cv.badType"));
      return setPhase("error");
    }
    if (file.size > maxMb * 1024 * 1024) {
      setMessage(t("apply.cv.tooLarge", { mb: maxMb }));
      return setPhase("error");
    }

    setFileName(file.name);
    setPhase("uploading");
    try {
      const step = async (url: string, payload: unknown) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? t("apply.cv.uploadFailed"));
        return json as { path: string; token: string; contentType: string };
      };
      // 1) lien d'envoi signé, 2) envoi direct vers le stockage (3 essais), 3) contrôle du fichier par le serveur
      const target = await step(`/api/apply/${jobId}/cv`, { questionId: q.id, name: file.name, size: file.size });
      let sent = false;
      for (let k = 0; k < 3 && !sent; k++) {
        const { error } = await createClient().storage.from("resumes").uploadToSignedUrl(target.path, target.token, file, { contentType: target.contentType });
        if (!error) sent = true;
        else if (k < 2) await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
      }
      if (!sent) throw new Error(t("apply.cv.uploadFailed"));
      await step(`/api/apply/${jobId}/cv/confirm`, { questionId: q.id, name: file.name });
      setPhase("done");
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("apply.cv.uploadFailed"));
      setPhase("error");
    }
  }

  const inputId = `cv-${q.id}`;
  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="label !mb-0">
        {q.label}
        {q.required && <span className="text-bad"> *</span>}
      </label>
      <label
        htmlFor={inputId}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:bg-primary-soft ${
          phase === "done" ? "border-good bg-good-soft" : phase === "error" ? "border-bad" : "border-line bg-surface-2"
        }`}
      >
        <span className="text-primary">
          <IconUpload />
        </span>
        <span className="font-semibold">
          {phase === "uploading"
            ? t("apply.cv.uploading")
            : phase === "done"
              ? t("apply.cv.uploaded", { name: fileName || "CV" })
              : t("apply.cv.choose")}
        </span>
        <span className="hint">{t("apply.cv.hint", { mb: maxMb })}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.doc,.docx"
        disabled={phase === "uploading"}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      {phase === "error" && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
