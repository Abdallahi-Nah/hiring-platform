"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Brand } from "@/components/ui/Brand";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useT } from "@/i18n/client";
import { login, logout } from "./actions";

// noAccessEmail : connecté, mais le compte n'a pas encore de rôle (aucun accès).
export function LoginForm({ noAccessEmail }: { noAccessEmail?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" aria-label={t("common.home")}>
            <Brand />
          </Link>
          <LanguageSwitcher />
        </div>

        {noAccessEmail && (
          <div className="card mb-4 grid gap-3 !border-warn" role="alert">
            <b>{t("login.noAccessTitle")}</b>
            <p className="hint">{t("login.noAccessText", { email: noAccessEmail })}</p>
            <form action={logout}>
              <button className="btn">{t("login.signOut")}</button>
            </form>
          </div>
        )}

        <form action={action} className="card grid gap-4">
          <div>
            <h1 className="title">{t("login.title")}</h1>
            <p className="hint mt-1">{t("login.subtitle")}</p>
          </div>
          <div>
            <label htmlFor="email" className="label">{t("login.email")}</label>
            <input id="email" name="email" type="email" dir="ltr" autoComplete="email" required className="field" />
          </div>
          <div>
            <label htmlFor="password" className="label">{t("login.password")}</label>
            <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="field" />
          </div>
          <Link href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
            {t("login.forgot")}
          </Link>
          {state?.error && (
            <p className="error-text" role="alert">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className="btn btn-primary btn-lg btn-block">
            {pending ? t("login.signingIn") : t("login.signIn")}
          </button>
          <p className="text-center text-sm">
            <Link href="/register" className="font-semibold text-primary hover:underline">
              {t("login.createAccount")}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
