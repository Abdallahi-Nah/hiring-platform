import { createAdminClient } from "@/lib/supabase/admin";

// La date limite est comprise : l'offre reste ouverte pendant toute la journée indiquée (UTC).
export const today = () => new Date().toISOString().slice(0, 10);
export const isExpired = (deadline?: string | null) => !!deadline && deadline < today();

export type PublicCompany = { name: string; slug: string; logo?: string | null };

export type PublicJob = {
  id: string;
  title: string;
  description: string | null;
  department?: string | null;
  location?: string | null;
  work_mode?: string | null;
  employment_type?: string | null;
  deadline?: string | null;
  created_at?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  company?: PublicCompany;
};

const COLS = "id, title, description, department, location, work_mode, employment_type, deadline, created_at, salary_min, salary_max, salary_currency, companies!inner(name, slug, logo_path, is_active)";

type Row = Omit<PublicJob, "company"> & { is_active?: boolean; companies: Omit<PublicCompany, "logo"> & { logo_path: string | null; is_active: boolean } };

const toJob = ({ companies, ...job }: Row): PublicJob => ({ ...job, company: { name: companies.name, slug: companies.slug, logo: companies.logo_path } });

// Seules les colonnes publiques sont lues (jamais les critères d'évaluation).
// Une offre est visible si elle est active ET si son entreprise est active.
export async function getPublicJobs(): Promise<PublicJob[]> {
  const { data } = await createAdminClient()
    .from("job_forms")
    .select(COLS)
    .eq("is_active", true)
    .eq("companies.is_active", true)
    .or(`deadline.is.null,deadline.gte.${today()}`)
    .order("created_at", { ascending: false })
    .limit(300);
  return ((data ?? []) as unknown as Row[]).map(toJob);
}

// is_active vaut vrai seulement si l'offre ET son entreprise sont actives.
export async function getPublicJob(id: string): Promise<(PublicJob & { is_active: boolean }) | null> {
  const { data } = await createAdminClient()
    .from("job_forms")
    .select(`${COLS}, is_active`)
    .eq("id", id)
    .single();
  if (!data) return null;
  const row = data as unknown as Row;
  return { ...toJob(row), is_active: !!row.is_active && row.companies.is_active && !isExpired(row.deadline) };
}
