// Entretien en direct : règles communes au serveur et au navigateur (rien de secret ici).

export const OPEN_BEFORE_MINUTES = 15; // la salle ouvre un quart d'heure avant l'heure prévue
export const EXPIRE_AFTER_HOURS = 24; // puis le lien expire 24 h après l'heure prévue
export const MAX_DAYS_AHEAD = 90;
export const DURATIONS = [15, 30, 45, 60] as const;

// Canal WebSocket secret de la salle : son nom contient le jeton du lien (impossible à deviner).
export const meetChannel = (token: string) => `meet:${token}`;

export type RoomWindow = "early" | "open" | "expired";

// Dit si la salle est ouverte à l'instant `now` pour un rendez-vous à `scheduledAt`.
export function roomWindow(scheduledAt: string, now = Date.now()): RoomWindow {
  const start = new Date(scheduledAt).getTime();
  if (now < start - OPEN_BEFORE_MINUTES * 60_000) return "early";
  if (now > start + EXPIRE_AFTER_HOURS * 3_600_000) return "expired";
  return "open";
}
