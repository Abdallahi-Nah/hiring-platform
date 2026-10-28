import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // pdfkit lit ses polices dans node_modules : il ne doit pas être empaqueté.
  serverExternalPackages: ["pdfkit"],
  partialPrefetching: true,
  // Les polices du PDF sont lues sur le disque : Vercel doit les inclure dans la fonction.
  outputFileTracingIncludes: { "/api/admin/jobs/[id]/export": ["./src/lib/fonts/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Le micro est autorisé pour nos pages (questions vocales) ; le reste est coupé.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
