// Le nom de l'entreprise vient de NEXT_PUBLIC_COMPANY_NAME (par défaut : Hiring Platform).
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "Hiring Platform";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark" aria-hidden>
        {COMPANY_NAME.charAt(0).toUpperCase()}
      </span>
      <span className="brand-text">{COMPANY_NAME}</span>
    </div>
  );
}
