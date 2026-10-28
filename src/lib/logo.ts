// Les logos sont dans un bucket public : l'adresse se déduit du chemin.
export const logoUrl = (path?: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${path}` : null;
