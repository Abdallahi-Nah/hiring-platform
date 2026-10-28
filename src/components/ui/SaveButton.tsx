"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleSaved } from "@/app/me/actions";
import { useT } from "@/i18n/client";
import { IconHeart } from "./icons";

// Cœur "favori" : sans compte candidat, envoie vers la connexion puis revient sur la page.
export function SaveButton({ jobId, saved: initial, withLabel = false }: { jobId: string; saved: boolean; withLabel?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const label = saved ? t("cand.saved.remove") : t("cand.saved.add");
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`btn !p-2.5 ${saved ? "!text-bad" : ""}`}
      onClick={() =>
        start(async () => {
          const res = await toggleSaved(jobId);
          if (res.login) return router.push(`/candidate/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          if (res.ok) setSaved(!!res.saved);
        })
      }
    >
      <IconHeart filled={saved} />
      {withLabel && <span className="ms-2">{label}</span>}
    </button>
  );
}
