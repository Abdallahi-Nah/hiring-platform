import type { CSSProperties } from "react";

// Barre de score : vert normal, rouge si le score est faible.
export function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  return (
    <div className="score" role="img" aria-label={`Score ${value}%`}>
      <div className="bar">
        <i style={{ width: `${value}%`, background: value < 40 ? "var(--bad)" : undefined }} />
      </div>
      <b>{value}%</b>
    </div>
  );
}

export function Ring({ value }: { value: number }) {
  return (
    <div className="ring" style={{ "--v": value } as CSSProperties} role="img" aria-label={`Score ${value}%`}>
      <b>
        {value}
        <small>%</small>
      </b>
    </div>
  );
}
