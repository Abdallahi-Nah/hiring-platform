"use client";

import { useState, useTransition } from "react";
import { Brand } from "@/components/ui/Brand";
import { IconShield } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useT } from "@/i18n/client";
import type { QuestionRow } from "@/lib/jobs/schema";
import { savePage, startApplication } from "./actions";
import { QuestionField, type Value } from "./QuestionField";

type Props = {
  jobId: string;
  title: string;
  description: string | null;
  questions: QuestionRow[];
  initialPage: number | null;
  answeredMedia: string[];
  cvMaxMb: number;
  signedIn: boolean;
  prefill: Record<string, string>;
  profileCv: boolean;
};

function Hero({ title, total, current }: { title: string; total?: number; current?: number }) {
  const t = useT();
  return (
    <header className="hero">
      <div className="apply-col">
        <div className="flex items-center">
          <Brand light />
          <span className="flex-1" />
          <LanguageSwitcher />
          {total != null && current != null && (
            <span className="ms-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              {t("apply.stepOf", { current, total })}
            </span>
          )}
        </div>
        <h1 className="title mt-6">{title}</h1>
        {total != null && current != null && (
          <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={t("apply.progress")}>
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i < current ? "on" : ""} />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function Reassure() {
  const t = useT();
  return (
    <p className="hint flex items-center gap-2">
      <IconShield />
      {t("apply.saved")}
    </p>
  );
}

export function ApplyFlow({ jobId, title, description, questions, initialPage, answeredMedia, cvMaxMb, signedIn, prefill, profileCv }: Props) {
  const t = useT();
  const [page, setPage] = useState<number | null>(initialPage);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<Record<string, Value>>(prefill);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [agreed, setAgreed] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<Record<string, boolean>>({});
  const [mediaDone, setMediaDone] = useState<string[]>(answeredMedia);
  const recording = Object.values(mediaBusy).some(Boolean);

  const pages = [...new Set(questions.map((q) => q.page_number))].sort((a, b) => a - b);

  if (done) {
    return (
      <div className="min-h-screen">
        <Hero title={title} />
        <div className="apply-col -mt-12 px-4 pb-10">
          <div className="card grid gap-3 py-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good-soft text-2xl text-good" aria-hidden>
              ✓
            </div>
            <h2 className="sub-title text-xl">{t("apply.thanksTitle")}</h2>
            <p className="text-muted">{t("apply.thanksText")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (page == null) {
    return (
      <div className="min-h-screen">
        <Hero title={title} />
        <div className="apply-col -mt-12 px-4 pb-10">
          <div className="card grid gap-5">
            {description && <p className="whitespace-pre-wrap">{description}</p>}
            <ul className="grid gap-2 text-sm text-muted">
              <li>• {t("apply.intro1", { n: pages.length })}</li>
              <li>• {t("apply.intro2")}</li>
              <li>• {t("apply.intro3")}</li>
            </ul>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
              <span>
                {t("apply.consent")}{" "}
                <a href="/privacy" target="_blank" rel="noopener" className="font-semibold text-primary hover:underline">
                  {t("apply.readPolicy")}
                </a>
              </span>
            </label>
            {signedIn ? (
              <p className="chip chip-good !whitespace-normal" role="status">
                ✓ {profileCv ? t("cand.apply.usingProfileCv") : t("cand.apply.usingProfile")}
              </p>
            ) : (
              <p className="hint">
                {t("cand.apply.haveAccount")}{" "}
                <a href={`/candidate/login?next=${encodeURIComponent(`/apply/${jobId}`)}`} className="font-semibold text-primary hover:underline">
                  {t("login.signIn")}
                </a>
              </p>
            )}
            {error && <p className="error-text" role="alert">{error}</p>}
            <button
              disabled={pending || !agreed}
              className="btn btn-primary btn-lg btn-block"
              onClick={() =>
                start(async () => {
                  const res = await startApplication(jobId, agreed);
                  if (res.error || res.page == null) return setError(res.error ?? t("apply.genericError"));
                  setError("");
                  if (res.cvAttached) setMediaDone((prev) => [...prev, ...questions.filter((q) => q.type === "file_upload").map((q) => q.id)]);
                  setPage(res.page);
                })
              }
            >
              {pending ? t("apply.starting") : t("apply.start")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = questions.filter((q) => q.page_number === page);
  const index = pages.indexOf(page);
  const isLast = index === pages.length - 1;

  function next() {
    start(async () => {
      const res = await savePage(jobId, page!, values);
      if (res.errors) return setErrors(res.errors);
      if (res.error) return setError(res.error);
      setErrors({});
      setError("");
      if (res.done) return setDone(true);
      setPage(res.nextPage!);
      window.scrollTo(0, 0);
    });
  }

  return (
    <div className="min-h-screen">
      <Hero title={title} total={pages.length} current={index + 1} />
      <div className="apply-col -mt-12 px-4 pb-10">
        <div className="card grid gap-6">
          {current.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={values[q.id]}
              error={errors[q.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [q.id]: v }))}
              jobId={jobId}
              cvMaxMb={cvMaxMb}
              mediaDone={mediaDone.includes(q.id)}
              onMediaBusy={(busy) => setMediaBusy((prev) => ({ ...prev, [q.id]: busy }))}
              onMediaDone={() => setMediaDone((prev) => [...prev, q.id])}
            />
          ))}
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
        <div className="mt-4 grid gap-3">
          <button disabled={pending || recording} onClick={next} className="btn btn-primary btn-lg btn-block">
            {pending ? t("apply.saving") : isLast ? t("apply.submit") : t("apply.next")}
          </button>
          <Reassure />
        </div>
      </div>
    </div>
  );
}
