"use client";

import { useEffect } from "react";

// Compte la visite d'une offre : une seule fois par session de navigation, jamais pour les robots (sans JavaScript).
export function ViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    const key = `viewed:${jobId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // stockage bloqué : on compte quand même
    }
    void fetch(`/api/views/${jobId}`, { method: "POST", keepalive: true }).catch(() => {});
  }, [jobId]);
  return null;
}
