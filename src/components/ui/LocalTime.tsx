"use client";

// Affiche une date dans le fuseau horaire du navigateur de la personne (le serveur est en UTC).
export function LocalTime({ iso, localeTag }: { iso: string; localeTag: string }) {
  const text = new Date(iso).toLocaleString(localeTag, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
