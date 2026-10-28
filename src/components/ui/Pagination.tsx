import Link from "next/link";
import { getI18n } from "@/i18n/server";

// Liens "Précédent / Suivant" qui gardent les filtres de l'adresse (seul "page" change).
export async function Pagination({
  basePath,
  params,
  page,
  pages,
  className = "",
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pages: number;
  className?: string;
}) {
  if (pages <= 1) return null;
  const { t } = await getI18n();
  const href = (p: number) => {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className={`flex items-center justify-center gap-3 ${className}`} aria-label={t("common.pagination")}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn" rel="prev">
          <span className="inline-block rtl:rotate-180">←</span> {t("common.prev")}
        </Link>
      ) : (
        <span className="btn pointer-events-none opacity-40" aria-disabled="true">
          <span className="inline-block rtl:rotate-180">←</span> {t("common.prev")}
        </span>
      )}
      <span className="hint" aria-current="page">{t("common.pageOf", { page, pages })}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className="btn" rel="next">
          {t("common.next")} <span className="inline-block rtl:rotate-180">→</span>
        </Link>
      ) : (
        <span className="btn pointer-events-none opacity-40" aria-disabled="true">
          {t("common.next")} <span className="inline-block rtl:rotate-180">→</span>
        </span>
      )}
    </nav>
  );
}
