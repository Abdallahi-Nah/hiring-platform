import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Limite le nombre de demandes par adresse IP. Retourne false si la limite est dépassée.
// En cas d'erreur technique on laisse passer : un candidat ne doit pas être bloqué à tort.
export async function rateLimit(name: string, max: number, windowSeconds: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";

  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `${name}:${ip}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rateLimit", error.message);
    return true;
  }
  return data === true;
}

