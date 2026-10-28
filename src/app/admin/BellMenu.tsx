"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { IconBell } from "@/components/ui/icons";
import { useT } from "@/i18n/client";
import { markNotificationsSeen } from "./notification-actions";

export type BellItem = { id: string; kind: string; applicationId: string | null; who: string; job: string; when: string; unread: boolean };

export function BellMenu({ items, unread }: { items: BellItem[]; unread: number }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  function close() {
    setOpen(false);
    if (opened.current) {
      opened.current = false;
      router.refresh();
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        if (opened.current) {
          opened.current = false;
          router.refresh();
        }
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, router]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="btn relative !p-2.5"
        aria-label={unread > 0 ? t("hr1.bell.unread", { n: unread }) : t("hr1.bell.title")}
        aria-expanded={open}
        onClick={() => {
          if (open) return close();
          setOpen(true);
          if (unread > 0) {
            opened.current = true;
            start(async () => void (await markNotificationsSeen()));
          }
        }}
      >
        <IconBell />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold leading-5 text-white" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute end-0 z-30 mt-2 grid w-80 max-w-[85vw] gap-1 !p-2">
          <p className="px-2 py-1 text-sm font-semibold">{t("hr1.bell.title")}</p>
          {items.length === 0 && <p className="hint px-2 py-4 text-center">{t("hr1.bell.empty")}</p>}
          {items.map((i) => (
            <Link
              key={i.id}
              href={i.applicationId ? `/admin/candidates/${i.applicationId}` : "/admin"}
              onClick={close}
              className={`grid gap-0.5 rounded-lg px-2 py-2 text-sm hover:bg-surface-2 ${i.unread ? "bg-surface-2 font-semibold" : ""}`}
            >
              <span dir="auto">{t(i.kind === "message" ? "hr1.bell.message" : i.kind === "interview" ? "ivid.bell" : "hr1.bell.application", { who: i.who })}</span>
              <span className="hint font-normal" dir="auto">{i.job} · {i.when}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
