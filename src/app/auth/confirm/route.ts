import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { provisionCompany } from "@/lib/company-signup";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["invite", "recovery", "magiclink", "signup", "email"];

// On n'accepte que des chemins du site (jamais une adresse externe).
const safeNext = (v: string | null, fallback: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : fallback);

// Page ouverte depuis le lien de l'email (invitation ou mot de passe oublié) :
// vérifie le code, ouvre la session, puis envoie vers la page du mot de passe.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tokenHash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  const code = sp.get("code");

  const supabase = await createClient();
  let ok = false;
  try {
    if (code) {
      const res = await supabase.auth.exchangeCodeForSession(code);
      ok = !res.error;
      if (res.error) console.error("[auth/confirm] exchangeCodeForSession:", res.error.message);
    } else if (tokenHash && type && TYPES.includes(type)) {
      const res = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      ok = !res.error;
      if (res.error) console.error("[auth/confirm] verifyOtp:", res.error.message);
      // Inscription d'une entreprise : on crée l'entreprise une fois l'email confirmé.
      if (ok && type === "signup" && res.data.user) await provisionCompany(res.data.user);
    }
  } catch (e) {
    console.error("[auth/confirm]", e);
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (ok) {
    url.pathname = safeNext(sp.get("next"), type === "signup" ? "/admin" : "/set-password");
  } else {
    url.pathname = "/forgot-password";
    url.searchParams.set("error", "link");
  }
  return NextResponse.redirect(url);
}
