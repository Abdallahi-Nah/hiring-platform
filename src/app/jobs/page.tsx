import { redirect } from "next/navigation";

export const instant = false;

// La liste des offres est maintenant la page d'accueil. L'ancienne adresse y renvoie (filtres gardés).
export default async function JobsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  const qs = params.toString();
  redirect(qs ? `/?${qs}` : "/");
}
