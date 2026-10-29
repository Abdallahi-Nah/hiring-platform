import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Qui est connecté, sans appeler le serveur d'authentification : la signature du jeton est vérifiée sur place
// (getClaims). Chaque appel réseau vers Supabase coûte 0,5 s ou plus, et une page en faisait plusieurs.
// cache() : un seul calcul par requête, même si le layout et la page le demandent tous les deux.
export const sessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return claims?.sub ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" } : null;
});
