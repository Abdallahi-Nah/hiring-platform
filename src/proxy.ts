import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims vérifie le jeton sur place (et le renouvelle s'il a expiré) : pas d'appel réseau à chaque page.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // L'espace candidat demande une connexion : on renvoie vers la page de connexion candidat.
  if (!user && request.nextUrl.pathname.startsWith("/me")) {
    const url = new URL("/candidate/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // /login ne redirige plus vers /admin : un compte connecté mais sans profil
  // (donc sans accès) créerait une boucle de redirections.
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/me/:path*", "/candidate/:path*"],
};
