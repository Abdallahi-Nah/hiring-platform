"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recharge la page toutes les quelques secondes tant qu'une analyse IA est en cours.
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
