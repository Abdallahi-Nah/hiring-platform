import { logoUrl } from "@/lib/logo";

// Le logo est décoratif : le nom de l'entreprise est toujours écrit à côté.
export function CompanyLogo({ path, size = 28 }: { path?: string | null; size?: number }) {
  const src = logoUrl(path);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-md border border-line bg-white object-contain" style={{ width: size, height: size }} />;
}
