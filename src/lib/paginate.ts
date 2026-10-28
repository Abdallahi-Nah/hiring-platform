// Pagination en mémoire : on garde la page demandée dans la limite des pages existantes.
export function paginate<T>(items: T[], pageParam: string, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, parseInt(pageParam, 10) || 1));
  return { items: items.slice((page - 1) * size, page * size), page, pages, total: items.length };
}

// Une date de filtre doit être au format AAAA-MM-JJ, sinon elle est ignorée.
export const validDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

// Le jour (UTC) d'une date ISO est comparé aux bornes "du" et "au" (incluses).
export const inDateRange = (iso: string, from: string, to: string) => {
  const day = iso.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
};
