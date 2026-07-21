import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Desenrole.ai">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {t("howItWorks")}
          </a>
          <a
            href="#tools"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {t("tools")}
          </a>
          <a
            href="#pricing"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {t("pricing")}
          </a>
          <a
            href="#faq"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {t("faq")}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              {t("login")}
            </Button>
          </Link>
          <Link href="/quiz">
            <Button size="sm">{t("start")}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
