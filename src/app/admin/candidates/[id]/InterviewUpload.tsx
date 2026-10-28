"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconUpload } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { createClient } from "@/lib/supabase/client";
import {
  addInterviewLink,
  createInterviewUpload,
  registerInterview,
  retryInterviewAnalysis,
} from "../interview-actions";

export function InterviewUpload({ applicationId }: { applicationId: string }) {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setMessage(t("admin.detail.uploading"));
    try {
      const ticket = await createInterviewUpload(applicationId, file.name, file.size);
      if (ticket.error || !ticket.path || !ticket.token) throw new Error(ticket.error);

      const { error } = await createClient()
        .storage.from("interviews")
        .uploadToSignedUrl(ticket.path, ticket.token, file);
      if (error) throw new Error(t("admin.detail.uploadFailed"));

      const res = await registerInterview(applicationId, ticket.path);
      if (res.error) throw new Error(res.error);
      setMessage(t("admin.detail.uploadedAnalysing"));
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("admin.detail.uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 border-t border-line pt-4 text-sm">
      <label
        htmlFor="interview-file"
        className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line bg-surface-2 px-4 py-5 text-center hover:bg-primary-soft"
      >
        <span className="text-primary"><IconUpload /></span>
        <span className="font-semibold">{busy ? t("apply.cv.uploading") : t("admin.detail.uploadInterview")}</span>
        <span className="hint">{t("admin.detail.uploadHint")}</span>
      </label>
      <input
        id="interview-file"
        type="file"
        accept=".flac,.mp3,.mp4,.mpeg,.mpga,.m4a,.ogg,.wav,.webm"
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      <form
        className="flex gap-2"
        action={(fd) =>
          start(async () => {
            const res = await addInterviewLink(applicationId, String(fd.get("link") ?? ""));
            setMessage(res.error ?? t("admin.detail.linkSaved"));
            if (res.ok) router.refresh();
          })
        }
      >
        <label htmlFor="interview-link" className="sr-only">{t("admin.detail.videoLink")}</label>
        <input id="interview-link" name="link" type="url" placeholder={t("admin.detail.videoLinkPlaceholder")} dir="ltr" className="field flex-1" />
        <button disabled={pending} className="btn">
          {t("admin.detail.saveLink")}
        </button>
      </form>
      {message && <p className="hint" role="status">{message}</p>}
    </div>
  );
}

export function RetryButton({ interviewId }: { interviewId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await retryInterviewAnalysis(interviewId);
            setError(res.error ?? "");
            router.refresh();
          })
        }
        className="btn !py-1"
      >
        {pending ? t("admin.detail.retrying") : t("admin.detail.retry")}
      </button>
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}
