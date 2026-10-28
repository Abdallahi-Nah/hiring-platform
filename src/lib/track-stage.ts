export const STEPS = ["sent", "seen", "interview", "decision"] as const;
export type Step = (typeof STEPS)[number];

type Input = {
  status: string;
  viewed_at: string | null;
  decision_email_sent_at: string | null;
  hr_decision: string | null;
  interviews: number;
};

// Étape montrée au candidat. Le résultat n'apparaît qu'après l'envoi de l'email de décision :
// jamais de décision interne, ni de score.
export function computeStage(a: Input) {
  const outcome = a.decision_email_sent_at ? (a.hr_decision === "hire" ? "accepted" : a.hr_decision === "reject" ? "rejected" : null) : null;
  const reached: Record<Step, boolean> = {
    sent: true,
    seen: !!a.viewed_at || a.status !== "submitted",
    interview: a.interviews > 0 || ["interviewed", "evaluated", "final_recommendation_ready"].includes(a.status),
    decision: outcome !== null,
  };
  const current = [...STEPS].reverse().find((s) => reached[s]) ?? "sent";
  return { outcome, reached, current: current as Step };
}
