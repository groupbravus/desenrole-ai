"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound, Settings, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/data/types";

export function UserMenu({ user }: { user: CurrentUser }) {
  const t = useTranslations("shell.userMenu");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = user.name ?? user.email;

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("trigger")}
        className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
      >
        <Avatar name={displayName} src={user.avatarUrl} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-surface-overlay p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
          >
            <UserRound className="h-4 w-4 text-muted" aria-hidden />
            {t("profile")}
          </Link>
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
          >
            <Settings className="h-4 w-4 text-muted" aria-hidden />
            {t("settings")}
          </Link>
          <div className="my-1 h-px bg-border" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t("logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
