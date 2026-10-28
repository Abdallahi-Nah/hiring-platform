import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Candidate = { id: string; email: string };

// Un candidat est un utilisateur connecté SANS profil RH : un compte RH n'est jamais traité comme un candidat.
export async function getCandidate(): Promise<Candidate | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (staff) return null;
  return { id: user.id, email: user.email ?? "" };
}

export async function requireCandidate(next = "/me"): Promise<Candidate> {
  const candidate = await getCandidate();
  if (!candidate) redirect(`/candidate/login?next=${encodeURIComponent(next)}`);
  return candidate;
}

// Email du compte RH connecté (s'il y en a un) : un compte RH ne peut pas servir d'espace candidat.
export async function getStaffEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  return staff ? (user.email ?? "") : null;
}

// Qui est connecté : un candidat, un compte RH, ou personne.
export async function getAccountKind(): Promise<"candidate" | "staff" | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  return staff ? "staff" : "candidate";
}
