import { useTranslations } from "next-intl";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";
import { NavList } from "./nav-list";
import type { NavItem } from "@/lib/nav-config";

export function Sidebar({
  items,
  navNamespace,
  homeHref,
  variant,
  isAdmin = false,
}: {
  items: NavItem[];
  navNamespace: string;
  homeHref: string;
  variant: "app" | "admin";
  isAdmin?: boolean;
}) {
  const t = useTranslations("shell");

  return (
    <aside className="hidden shrink-0 border-r border-border md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href={homeHref} aria-label="Desenrole.ai">
          <Logo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavList items={items} namespace={navNamespace} />
      </div>

      {/* O link só aparece para admin, mas quem protege a rota é o
          servidor (requireAdmin) — esconder o menu não é segurança. */}
      {variant === "app" && isAdmin && (
        <div className="px-3 pb-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            {t("adminAccess")}
          </Link>
        </div>
      )}

      {variant === "admin" && (
        <div className="px-3 pb-2">
          <Link
            href="/painel"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {t("backToApp")}
          </Link>
        </div>
      )}
    </aside>
  );
}
