"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanyState } from "../companies/actions";

// Le Super Admin change le nom de sa propre entreprise (les règles RLS le limitent à elle).
export async function renameMyCompany(_prev: CompanyState, fd: FormData): Promise<CompanyState> {
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) return { error: t("admin.companies.errName") };
  const { error } = await (await createClient()).from("companies").update({ name }).eq("id", me.companyId);
  if (error) return { error: t("admin.companies.errSave") };
  revalidatePath("/admin", "layout");
  return { ok: t("admin.common.saved") };
}

const MAX_LOGO_BYTES = 1024 * 1024;

// Type réel du fichier d'après ses premiers octets (le type envoyé par le navigateur n'est pas fiable).
function imageKind(b: Buffer): "png" | "jpg" | "webp" | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function uploadLogo(_prev: CompanyState, fd: FormData): Promise<CompanyState> {
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: t("admin.company.errLogoFile") };
  if (file.size > MAX_LOGO_BYTES) return { error: t("admin.company.errLogoSize") };
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return { error: t("admin.company.errLogoType") };

  const supabase = await createClient();
  const { data: current } = await supabase.from("companies").select("logo_path").eq("id", me.companyId).single();

  const db = createAdminClient();
  const path = `${me.companyId}/${randomUUID()}.${kind}`;
  const { error: upErr } = await db.storage
    .from("logos")
    .upload(path, bytes, { contentType: kind === "jpg" ? "image/jpeg" : `image/${kind}` });
  if (upErr) return { error: t("admin.company.errLogoSave") };

  const { error } = await supabase.from("companies").update({ logo_path: path }).eq("id", me.companyId);
  if (error) {
    await db.storage.from("logos").remove([path]);
    return { error: t("admin.company.errLogoSave") };
  }
  if (current?.logo_path) await db.storage.from("logos").remove([current.logo_path]);
  revalidatePath("/", "layout");
  return { ok: t("admin.common.saved") };
}

export async function removeLogo(): Promise<CompanyState> {
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: current } = await supabase.from("companies").select("logo_path").eq("id", me.companyId).single();
  const { error } = await supabase.from("companies").update({ logo_path: null }).eq("id", me.companyId);
  if (error) return { error: t("admin.company.errLogoSave") };
  if (current?.logo_path) await createAdminClient().storage.from("logos").remove([current.logo_path]);
  revalidatePath("/", "layout");
  return { ok: t("admin.common.saved") };
}

// Présentation publique de l'entreprise (page /c/<adresse>).
export async function updateCompanyProfile(_prev: CompanyState, fd: FormData): Promise<CompanyState> {
  const me = await requireUser(["super_admin"]);
  const { t } = await getI18n();
  const description = String(fd.get("description") ?? "").trim();
  const city = String(fd.get("city") ?? "").trim();
  const website = String(fd.get("website") ?? "").trim();
  if (description.length > 1500 || city.length > 80 || website.length > 200) return { error: t("hr1.companyPage.errLength") };
  if (website) {
    // Seuls les liens http(s) sont acceptés (jamais javascript:).
    try {
      if (!["http:", "https:"].includes(new URL(website).protocol)) throw new Error("protocol");
    } catch {
      return { error: t("hr1.companyPage.errWebsite") };
    }
  }
  const { error } = await (await createClient())
    .from("companies")
    .update({ description: description || null, city: city || null, website: website || null })
    .eq("id", me.companyId);
  if (error) return { error: t("admin.companies.errSave") };
  revalidatePath("/c", "layout");
  return { ok: t("admin.common.saved") };
}
