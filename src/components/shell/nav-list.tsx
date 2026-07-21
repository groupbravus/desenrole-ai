"use client";

import { useTranslations } from "next-intl";
import {
  Home,
  Wrench,
  Gamepad2,
  History,
  UserRound,
  Settings,
  LifeBuoy,
  LayoutDashboard,
  Users,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-config";

const NAV_ICONS: Record<string, LucideIcon> = {
  Home,
  Wrench,
  Gamepad2,
  History,
  UserRound,
  Settings,
  LifeBuoy,
  LayoutDashboard,
  Users,
  CreditCard,
};

export function NavList({
  items,
  namespace,
  onNavigate,
}: {
  items: NavItem[];
  namespace: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations(namespace);
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = NAV_ICONS[item.icon] ?? Home;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent-muted text-accent"
                : "text-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
