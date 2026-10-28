import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Adresse de page proposée à partir du nom (lettres latines sans accents).
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");

// Texte sans caractères de contrôle ni retours à la ligne.
export const cleanName = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f<>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Après la confirmation de l'email : crée l'entreprise et fait de l'utilisateur son Super Admin.
// Ne fait rien si le compte a déjà un profil (invité, ou lien déjà utilisé). N'utilise que le nom saisi.
export async function provisionCompany(user: User): Promise<boolean> {
  const name = cleanName(user.user_metadata?.company_name, 80);
  if (name.length < 2) return false;

  const db = createAdminClient();
  const { data: existing } = await db.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) return false;

  const base = slugify(name) || "company";
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 && slugify(name) ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const { data: company, error } = await db.from("companies").insert({ name, slug }).select("id").single();
    if (error?.code === "23505") continue; // adresse déjà prise : on réessaie avec un suffixe
    if (error || !company) {
      console.error("[provisionCompany]", error?.message);
      return false;
    }
    const fullName = cleanName(user.user_metadata?.full_name, 80) || null;
    const { error: profileError } = await db
      .from("profiles")
      .insert({ id: user.id, role: "super_admin", company_id: company.id, full_name: fullName });
    if (profileError) {
      console.error("[provisionCompany] profile", profileError.message);
      await db.from("companies").delete().eq("id", company.id);
      return false;
    }
    return true;
  }
  return false;
}
