"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { deleteJob, duplicateJob, setJobActive } from "../actions";

export function JobActions({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  return (
    <div className="grid gap-2 sm:justify-items-end">
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setJobActive(id, !isActive);
              setError(res.error ?? "");
            })
          }
          className={`btn ${isActive ? "" : "btn-primary"}`}
        >
          {isActive ? t("admin.jobForm.deactivate") : t("admin.jobForm.publish")}
        </button>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await duplicateJob(id);
              if (res?.error) setError(res.error);
            })
          }
          className="btn"
        >
          {t("admin.jobForm.duplicate")}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (confirm(t("admin.jobForm.deleteConfirm"))) start(() => deleteJob(id));
          }}
          className="btn btn-danger"
        >
          {t("admin.common.delete")}
        </button>
      </div>
      {error && <p className="error-text max-w-xs" role="alert">{error}</p>}
      {isActive && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: t("admin.jobForm.copyApplication"), path: "apply" },
            { label: t("admin.jobForm.copyJobPage"), path: "jobs" },
          ].map(({ label, path }) => (
            <button
              key={path}
              type="button"
              className="btn"
              onClick={async () => {
                const url = `${window.location.origin}/${path}/${id}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(path);
                  setTimeout(() => setCopied(""), 2000);
                } catch {
                  setError(t("admin.jobForm.copyFailed", { url }));
                }
              }}
            >
              {copied === path ? t("admin.jobForm.copied") : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
