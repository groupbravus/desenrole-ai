"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";
import { NavList } from "./nav-list";
import type { NavItem } from "@/lib/nav-config";

export function MobileNav({
  items,
  navNamespace,
  homeHref,
}: {
  items: NavItem[];
  navNamespace: string;
  homeHref: string;
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("openMenu")}
        className="text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="animate-fade-in absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 flex-col border-r border-border bg-surface p-5">
              <div className="mb-8 flex items-center justify-between">
                <Link href={homeHref} onClick={() => setOpen(false)}>
                  <Logo />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("closeMenu")}
                  className="text-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <NavList
                items={items}
                namespace={navNamespace}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
