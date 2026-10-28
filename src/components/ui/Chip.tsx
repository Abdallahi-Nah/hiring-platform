export type Tone = "primary" | "good" | "warn" | "bad" | "info" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  primary: "",
  good: "chip-good",
  warn: "chip-warn",
  bad: "chip-bad",
  info: "chip-info",
  neutral: "chip-neutral",
};

export function Chip({ tone = "primary", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`chip ${TONE_CLASS[tone]}`}>{children}</span>;
}
