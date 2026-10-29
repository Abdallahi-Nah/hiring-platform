import { cache } from "react";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/session-user";
import { createClient } from "@/lib/supabase/server";

export type Role = "super_admin" | "admin" | "reviewer";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  companyId: string;
  companyName: string;
  companyLogo: string | null;
  isPlatformAdmin: boolean;
};

// cache() : le layout et la page demandent l'utilisateur dans la même requête, la base n'est interrogée qu'une fois.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await sessionUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name, company_id, is_platform_admin, companies(name, logo_path)")
    .eq("id", user.id)
    .single();
  if (!profile) {
    // Session valide mais pas de profil : à lire dans le terminal si la connexion "ne tient pas".
    console.warn(`[auth] signed in as ${user.email} but no profile found${error ? ` (${error.message})` : ""}`);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: profile.role as Role,
    fullName: profile.full_name,
    companyId: profile.company_id,
    companyName: (profile.companies as unknown as { name: string } | null)?.name ?? "",
    companyLogo: (profile.companies as unknown as { logo_path: string | null } | null)?.logo_path ?? null,
    isPlatformAdmin: profile.is_platform_admin,
  };
});

export async function requireUser(allowed?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (allowed && !allowed.includes(user.role)) redirect("/admin");
  return user;
}

// Réservé au propriétaire de la plateforme (gestion des entreprises).
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/admin");
  return user;
}
