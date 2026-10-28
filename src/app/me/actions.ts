"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getI18n } from "@/i18n/server";
import { getCandidate, requireCandidate } from "@/lib/candidate-auth";
import { cleanName } from "@/lib/company-signup";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/jobs/schema";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MeResult = { ok?: boolean; error?: string; login?: boolean };

const txt = (max: number) => z.string().trim().max(max);
const httpUrl = z
  .string()
  .trim()
  .max(200)
  .refine((v) => {
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  });

const profileSchema = z.object({
  full_name: txt(80),
  phone: txt(30),
  headline: txt(120),
  skills: z.array(txt(40).min(1)).max(40),
  experience: z.array(z.object({ role: txt(80), company: txt(80), start: txt(10), end: txt(10), description: txt(600) })).max(15),
  education: z.array(z.object({ degree: txt(80), school: txt(80), year: txt(10) })).max(10),
  links: z.array(httpUrl).max(5),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export async function saveProfile(input: ProfileInput): Promise<MeResult> {
  const me = await requireCandidate("/me/profile");
  const { t } = await getI18n();
  const parsed = profileSchema.safeParse({
    ...input,
    skills: (input.skills ?? []).map((s) => cleanName(s, 40)).filter(Boolean),
    experience: (input.experience ?? []).filter((e) => e.role?.trim() || e.company?.trim()),
    education: (input.education ?? []).filter((e) => e.degree?.trim() || e.school?.trim()),
    links: (input.links ?? []).map((l) => l.trim()).filter(Boolean),
  });
  if (!parsed.success) {
    const bad = parsed.error.issues.some((i) => i.path[0] === "links");
    return { error: bad ? t("cand.profile.errLinks") : t("cand.profile.errSave") };
  }
  const { error } = await (await createClient())
    .from("candidate_profiles")
    .upsert({ user_id: me.id, ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: t("cand.profile.errSave") };
  revalidatePath("/me/profile");
  return { ok: true };
}

const MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};
const MAX_CV = 5 * 1024 * 1024;

function validSignature(ext: string, head: Uint8Array) {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (ext === "pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (ext === "docx") return starts(0x50, 0x4b);
  return starts(0xd0, 0xcf, 0x11, 0xe0);
}

// CV du profil : réutilisé automatiquement quand le candidat postule.
export async function uploadCv(_prev: MeResult | null, fd: FormData): Promise<MeResult> {
  const me = await requireCandidate("/me/profile");
  const { t } = await getI18n();
  if (!(await rateLimit("candidate-cv", 20, 3600))) return { error: t("common.tooMany") };
  const file = fd.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: t("apply.errors.missingFile") };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const okMime = !file.type || file.type === "application/octet-stream" || MIME[ext]?.includes(file.type);
  if (!MIME[ext] || !okMime) return { error: t("apply.cv.badType") };
  if (file.size > MAX_CV) return { error: t("apply.cv.tooLarge", { mb: 5 }) };
  if (!validSignature(ext, new Uint8Array(await file.slice(0, 8).arrayBuffer()))) return { error: t("apply.errors.cvBadSignature") };

  const db = createAdminClient();
  const { data: old } = await db.from("candidate_profiles").select("cv_path").eq("user_id", me.id).maybeSingle();
  const path = `${me.id}/cv.${ext}`;
  const { error: upErr } = await db.storage.from("candidate-cv").upload(path, file, { contentType: file.type || MIME[ext][0], upsert: true });
  if (upErr) return { error: t("apply.errors.cannotUploadFile") };
  if (old?.cv_path && old.cv_path !== path) await db.storage.from("candidate-cv").remove([old.cv_path]);
  const { error } = await db
    .from("candidate_profiles")
    .upsert({ user_id: me.id, cv_path: path, cv_name: cleanName(file.name, 200), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: t("apply.errors.cannotSaveFile") };
  revalidatePath("/me/profile");
  return { ok: true };
}

export async function removeCv(): Promise<MeResult> {
  const me = await requireCandidate("/me/profile");
  const db = createAdminClient();
  const { data: old } = await db.from("candidate_profiles").select("cv_path").eq("user_id", me.id).maybeSingle();
  if (old?.cv_path) await db.storage.from("candidate-cv").remove([old.cv_path]);
  await db.from("candidate_profiles").update({ cv_path: null, cv_name: null }).eq("user_id", me.id);
  revalidatePath("/me/profile");
  return { ok: true };
}

// Favoris : sans compte, la page demande de se connecter.
export async function toggleSaved(jobId: string): Promise<MeResult & { saved?: boolean }> {
  const me = await getCandidate();
  if (!me) return { login: true };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("saved_jobs").select("job_form_id").eq("job_form_id", jobId).maybeSingle();
  if (existing) {
    await supabase.from("saved_jobs").delete().eq("job_form_id", jobId);
    revalidatePath("/me/saved");
    return { ok: true, saved: false };
  }
  const { error } = await supabase.from("saved_jobs").insert({ user_id: me.id, job_form_id: jobId });
  if (error) return { error: "save" };
  revalidatePath("/me/saved");
  return { ok: true, saved: true };
}

const alertSchema = z.object({
  query: txt(80),
  location: txt(80),
  employment_type: z.enum(EMPLOYMENT_TYPES).nullable(),
  work_mode: z.enum(WORK_MODES).nullable(),
  min_salary: z.number().int().min(0).max(1_000_000_000).nullable(),
});

export async function saveAlert(_prev: MeResult | null, fd: FormData): Promise<MeResult> {
  const me = await requireCandidate("/me/alerts");
  const { t, locale } = await getI18n();
  const salary = String(fd.get("min_salary") ?? "").trim();
  const parsed = alertSchema.safeParse({
    query: cleanName(fd.get("query"), 80),
    location: cleanName(fd.get("location"), 80),
    employment_type: String(fd.get("employment_type") ?? "") || null,
    work_mode: String(fd.get("work_mode") ?? "") || null,
    min_salary: salary === "" ? null : Number(salary),
  });
  if (!parsed.success) return { error: t("cand.alerts.errSave") };
  const d = parsed.data;
  if (!d.query && !d.location && !d.employment_type && !d.work_mode && d.min_salary == null) return { error: t("cand.alerts.errEmpty") };
  const { error } = await (await createClient()).from("job_alerts").insert({
    user_id: me.id,
    query: d.query || null,
    location: d.location || null,
    employment_type: d.employment_type,
    work_mode: d.work_mode,
    min_salary: d.min_salary,
    locale,
  });
  if (error) return { error: error.code === "23514" ? t("cand.alerts.errMax") : t("cand.alerts.errSave") };
  revalidatePath("/me/alerts");
  return { ok: true };
}

export async function deleteAlert(id: string): Promise<MeResult> {
  await requireCandidate("/me/alerts");
  await (await createClient()).from("job_alerts").delete().eq("id", id);
  revalidatePath("/me/alerts");
  return { ok: true };
}
