"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { IconClose, IconMenu } from "@/components/ui/icons";
import { useT } from "@/i18n/client";

type Ctx = { open: boolean; setOpen: (v: boolean) => void; burger: React.RefObject<HTMLButtonElement | null> };
const DrawerContext = createContext<Ctx | null>(null);
const useDrawer = () => {
  const c = useContext(DrawerContext);
  if (!c) throw new Error("DrawerProvider missing");
  return c;
};

// Sur téléphone (760 px et moins) le menu latéral devient un tiroir ouvert par le bouton burger.
// Le fournisseur enveloppe toute la page admin pour que le bouton (en haut) et le tiroir (le menu) partagent l'état.
export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);

  // Échap ferme le tiroir ; la page ne défile pas derrière ; il se ferme si l'écran devient large.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burger.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 761px)");
    const onWide = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <DrawerContext.Provider value={{ open, setOpen, burger }}>
      <div className="shell">
        {children}
        <div className={`drawer-backdrop ${open ? "on" : ""}`} onClick={() => setOpen(false)} aria-hidden />
      </div>
    </DrawerContext.Provider>
  );
}

export function BurgerButton() {
  const t = useT();
  const { open, setOpen, burger } = useDrawer();
  return (
    <button ref={burger} type="button" className="btn burger !px-3" aria-label={t("admin.nav.menu")} aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(true)}>
      <IconMenu />
    </button>
  );
}

// Le menu lui-même. Un clic sur un lien le referme ; sur téléphone fermé, il est caché (et sort de l'ordre de tabulation).
export function Drawer({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { open, setOpen, burger } = useDrawer();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) close.current?.focus();
  }, [open]);
  return (
    <aside id="admin-drawer" className={`side ${open ? "side-open" : ""}`} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      <button
        ref={close}
        type="button"
        className="btn drawer-close !p-2"
        aria-label={t("admin.nav.closeMenu")}
        onClick={() => {
          setOpen(false);
          burger.current?.focus();
        }}
      >
        <IconClose />
      </button>
      {children}
    </aside>
  );
}
