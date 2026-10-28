import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const instant = false;

export default async function LoginPage() {
  await connection();
  // Déjà connecté avec un rôle : inutile de redemander le mot de passe.
  if (await getCurrentUser()) redirect("/admin");

  // Connecté mais sans rôle : on l'explique au lieu de laisser croire que la connexion a échoué.
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();

  return <LoginForm noAccessEmail={user?.email ?? undefined} />;
}
