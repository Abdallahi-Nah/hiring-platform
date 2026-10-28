import { useT } from "@/i18n/client";

export type TickState = "sent" | "delivered" | "read";

// Coches comme WhatsApp : ✓ envoyé, ✓✓ gris reçu, ✓✓ vert lu.
export function Ticks({ state }: { state: TickState }) {
  const t = useT();
  const label = t(state === "read" ? "rt.read" : state === "delivered" ? "rt.delivered" : "rt.sent");
  const color = state === "read" ? "text-good" : "text-muted";
  return (
    <svg viewBox="0 0 20 12" width="18" height="11" className={`inline-block ${color}`} role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <title>{label}</title>
      {state === "sent" ? (
        <path d="M3 6.5l3.2 3.2L13 2.5" />
      ) : (
        <>
          <path d="M1.5 6.5l3.2 3.2L11.5 2.5" />
          <path d="M8.5 9.4l.4.3L17.5 2.5" />
        </>
      )}
    </svg>
  );
}
