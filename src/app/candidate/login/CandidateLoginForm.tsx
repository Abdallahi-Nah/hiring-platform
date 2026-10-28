"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { candidateLogin, candidateOAuth } from "../actions";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function OAuthButtons({ next }: { next: string }) {
  const t = useT();
  return (
    <div className="grid gap-2">
      <form action={candidateOAuth}>
        <input type="hidden" name="provider" value="google" />
        <input type="hidden" name="next" value={next} />
        <button className="btn btn-block flex items-center justify-center gap-3">
          <GoogleIcon />
          {t("cand.oauth.google")}
        </button>
      </form>
      <p className="hint text-center">{t("cand.oauth.or")}</p>
    </div>
  );
}

export function CandidateLoginForm({ next, oauthError }: { next: string; oauthError: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(candidateLogin, null);
  return (
    <div className="grid gap-4">
      <OAuthButtons next={next} />
      {oauthError && <p className="error-text" role="alert">{t("cand.oauth.error")}</p>}
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="label">{t("login.email")}</label>
          <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required className="field" />
        </div>
        <div>
          <label htmlFor="password" className="label">{t("login.password")}</label>
          <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="field" />
        </div>
        <Link href="/candidate/forgot" className="text-sm font-semibold text-primary hover:underline">{t("login.forgot")}</Link>
        {state?.error && <p className="error-text" role="alert">{state.error}</p>}
        <button disabled={pending} className="btn btn-primary btn-lg btn-block">
          {pending ? t("login.signingIn") : t("login.signIn")}
        </button>
      </form>
      <p className="text-center text-sm">
        {t("cand.login.noAccount")}{" "}
        <Link href={`/candidate/register?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
          {t("cand.register.submit")}
        </Link>
      </p>
    </div>
  );
}
