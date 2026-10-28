import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getPublicJobs } from "@/lib/public-jobs";
import { siteUrl } from "@/lib/site-url";

// Accueil, confidentialité, offres ouvertes et pages entreprise. Les liens utilisent NEXT_PUBLIC_SITE_URL, sinon l'adresse de la requête.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = await siteUrl();
  const jobs = await getPublicJobs();
  const companies = [...new Set(jobs.map((j) => j.company?.slug).filter((s): s is string => !!s))];
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...jobs.map((j) => ({ url: `${base}/jobs/${j.id}`, lastModified: j.created_at, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...companies.map((slug) => ({ url: `${base}/c/${slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
