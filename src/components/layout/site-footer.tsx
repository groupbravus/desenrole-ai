import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">{t("tagline")}</p>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <span className="font-medium text-foreground">{t("product")}</span>
          <a href="#tools" className="text-muted hover:text-foreground">
            {t("tools")}
          </a>
          <a href="#pricing" className="text-muted hover:text-foreground">
            {t("pricing")}
          </a>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <span className="font-medium text-foreground">{t("legal")}</span>
          <Link href="/terms" className="text-muted hover:text-foreground">
            {t("terms")}
          </Link>
          <Link href="/privacy" className="text-muted hover:text-foreground">
            {t("privacy")}
          </Link>
          <Link href="/support" className="text-muted hover:text-foreground">
            {t("support")}
          </Link>
        </div>

        <LocaleSwitcher />
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-subtle">
        © {new Date().getFullYear()} Labia.ia — {t("rights")}
      </div>
    </footer>
  );
}
