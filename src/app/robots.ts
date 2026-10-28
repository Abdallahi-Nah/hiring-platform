import type { MetadataRoute } from "next";

// Les offres publiques peuvent être indexées ; les espaces privés et les liens secrets ne le sont jamais.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/me", "/candidate", "/track", "/apply", "/api", "/login", "/register"] },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
