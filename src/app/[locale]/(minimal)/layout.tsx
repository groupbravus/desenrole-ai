import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

/** Chrome mínimo — sem nav de marketing nem footer, foco total na tarefa. */
export default function MinimalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/" aria-label="Labia.ia">
          <Logo />
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
