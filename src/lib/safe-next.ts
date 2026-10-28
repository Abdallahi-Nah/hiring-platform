// On n'accepte que des chemins du site (jamais une adresse externe).
export const safeNext = (v: unknown, fallback: string) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
