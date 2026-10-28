"use client";

import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { saveProfile, type ProfileInput } from "../actions";

const emptyExp = { role: "", company: "", start: "", end: "", description: "" };
const emptyEdu = { degree: "", school: "", year: "" };

export function ProfileForm({ email, initial }: { email: string; initial: ProfileInput }) {
  const t = useT();
  const [p, setP] = useState({ ...initial, skillsText: initial.skills.join(", ") });
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((s) => ({ ...s, [k]: v }));
  const upd = <T,>(list: T[], i: number, patch: Partial<T>) => list.map((x, n) => (n === i ? { ...x, ...patch } : x));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { skillsText, ...rest } = p;
          setMsg(await saveProfile({ ...rest, skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean) }));
        });
      }}
    >
      <section className="card grid gap-4">
        <h2 className="sub-title">{t("cand.profile.about")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-name" className="label">{t("register.fullName")}</label>
            <input id="pf-name" value={p.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={80} dir="auto" autoComplete="name" className="field" />
          </div>
          <div>
            <label htmlFor="pf-phone" className="label">{t("cand.profile.phone")}</label>
            <input id="pf-phone" value={p.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} dir="ltr" autoComplete="tel" className="field" />
          </div>
        </div>
        <div>
          <label htmlFor="pf-email" className="label">{t("register.email")}</label>
          <input id="pf-email" value={email} readOnly dir="ltr" className="field opacity-70" />
        </div>
        <div>
          <label htmlFor="pf-head" className="label">{t("cand.profile.headline")}</label>
          <input id="pf-head" value={p.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} dir="auto" placeholder={t("cand.profile.headlineHint")} className="field" />
        </div>
        <div>
          <label htmlFor="pf-skills" className="label">{t("cand.profile.skills")}</label>
          <input id="pf-skills" value={p.skillsText} onChange={(e) => set("skillsText", e.target.value)} dir="auto" className="field" />
          <p className="hint mt-1">{t("cand.profile.skillsHint")}</p>
        </div>
      </section>

      <section className="card grid gap-4">
        <h2 className="sub-title">{t("cand.profile.experience")}</h2>
        {p.experience.map((x, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input aria-label={t("cand.profile.role")} placeholder={t("cand.profile.role")} value={x.role} onChange={(e) => set("experience", upd(p.experience, i, { role: e.target.value }))} maxLength={80} dir="auto" className="field" />
              <input aria-label={t("cand.profile.company")} placeholder={t("cand.profile.company")} value={x.company} onChange={(e) => set("experience", upd(p.experience, i, { company: e.target.value }))} maxLength={80} dir="auto" className="field" />
              <input aria-label={t("cand.profile.start")} placeholder={t("cand.profile.start")} value={x.start} onChange={(e) => set("experience", upd(p.experience, i, { start: e.target.value }))} maxLength={10} dir="ltr" className="field" />
              <input aria-label={t("cand.profile.end")} placeholder={t("cand.profile.end")} value={x.end} onChange={(e) => set("experience", upd(p.experience, i, { end: e.target.value }))} maxLength={10} dir="ltr" className="field" />
            </div>
            <textarea aria-label={t("cand.profile.description")} placeholder={t("cand.profile.description")} value={x.description} onChange={(e) => set("experience", upd(p.experience, i, { description: e.target.value }))} rows={2} maxLength={600} dir="auto" className="field" />
            <div>
              <button type="button" className="text-sm font-semibold text-bad hover:underline" onClick={() => set("experience", p.experience.filter((_, n) => n !== i))}>{t("admin.common.delete")}</button>
            </div>
          </div>
        ))}
        {p.experience.length < 15 && (
          <div><button type="button" className="btn" onClick={() => set("experience", [...p.experience, { ...emptyExp }])}>{t("cand.profile.addExperience")}</button></div>
        )}
      </section>

      <section className="card grid gap-4">
        <h2 className="sub-title">{t("cand.profile.education")}</h2>
        {p.education.map((x, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <input aria-label={t("cand.profile.degree")} placeholder={t("cand.profile.degree")} value={x.degree} onChange={(e) => set("education", upd(p.education, i, { degree: e.target.value }))} maxLength={80} dir="auto" className="field" />
              <input aria-label={t("cand.profile.school")} placeholder={t("cand.profile.school")} value={x.school} onChange={(e) => set("education", upd(p.education, i, { school: e.target.value }))} maxLength={80} dir="auto" className="field" />
              <input aria-label={t("cand.profile.year")} placeholder={t("cand.profile.year")} value={x.year} onChange={(e) => set("education", upd(p.education, i, { year: e.target.value }))} maxLength={10} dir="ltr" className="field" />
            </div>
            <div>
              <button type="button" className="text-sm font-semibold text-bad hover:underline" onClick={() => set("education", p.education.filter((_, n) => n !== i))}>{t("admin.common.delete")}</button>
            </div>
          </div>
        ))}
        {p.education.length < 10 && (
          <div><button type="button" className="btn" onClick={() => set("education", [...p.education, { ...emptyEdu }])}>{t("cand.profile.addEducation")}</button></div>
        )}
      </section>

      <section className="card grid gap-3">
        <h2 className="sub-title">{t("cand.profile.links")}</h2>
        <p className="hint">{t("cand.profile.linksHint")}</p>
        {p.links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={t("cand.profile.link")} value={l} onChange={(e) => set("links", p.links.map((x, n) => (n === i ? e.target.value : x)))} type="url" placeholder="https://" maxLength={200} dir="ltr" className="field" />
            <button type="button" className="btn" onClick={() => set("links", p.links.filter((_, n) => n !== i))}>{t("admin.common.delete")}</button>
          </div>
        ))}
        {p.links.length < 5 && (
          <div><button type="button" className="btn" onClick={() => set("links", [...p.links, ""])}>{t("cand.profile.addLink")}</button></div>
        )}
      </section>

      {msg.error && <p className="error-text" role="alert">{msg.error}</p>}
      {msg.ok && <p className="text-sm font-semibold text-good" role="status">✓ {t("admin.common.saved")}</p>}
      <div>
        <button disabled={pending} className="btn btn-primary btn-lg">{pending ? t("admin.common.saving") : t("cand.profile.save")}</button>
      </div>
    </form>
  );
}
