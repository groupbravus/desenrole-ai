import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import type { NavItem } from "@/lib/nav-config";
import type { CurrentUser } from "@/lib/data/types";

export function Topbar({
  items,
  navNamespace,
  homeHref,
  user,
}: {
  items: NavItem[];
  navNamespace: string;
  homeHref: string;
  user: CurrentUser;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <MobileNav
          items={items}
          navNamespace={navNamespace}
          homeHref={homeHref}
        />
        <Link href={homeHref} className="md:hidden" aria-label="Labia.ia">
          <Logo variant="mark" />
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <LocaleSwitcher />
        </div>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
