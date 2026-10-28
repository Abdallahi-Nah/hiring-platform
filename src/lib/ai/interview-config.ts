// Réglages de l'entretien vidéo, sans dépendance serveur : utilisables par les composants client.
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 8;
export const DEFAULT_QUESTIONS = 5;
export const PREP_SECONDS = 30;
export const MAX_ANSWER_SECONDS = 90;
export const MIN_ANSWER_SECONDS = 3;
export const INVITE_DAYS = 7;
export const RETENTION_MONTHS = 12;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // limite de Whisper (offre gratuite Groq)
export const VIDEO_TYPES: Record<string, string> = { "video/webm": "webm", "video/mp4": "mp4", "video/quicktime": "mov" };

// Whisper invente parfois du texte sur du bruit ou du silence ("Thank you for watching"). Moins de 4 mots = pas de parole.
export const MIN_SPOKEN_WORDS = 4;
export const hasSpeech = (text?: string | null) => (((text ?? "").match(/\p{L}+/gu) ?? []).length >= MIN_SPOKEN_WORDS);
