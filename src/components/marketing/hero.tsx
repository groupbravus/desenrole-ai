import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StartCta } from "@/components/marketing/start-cta";

export function Hero() {
  const t = useTranslations("landing.hero");
  const tCta = useTranslations("landing.cta");

  return (
    <section className="relative overflow-hidden">
      {/* Glow sutil de fundo — único elemento decorativo permitido */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-[120px]"
      />

      <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-24 pt-20 md:grid-cols-2 md:items-center md:pt-28">
        <div className="space-y-7">
          <Badge variant="accent" className="animate-fade-up">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t("badge")}
          </Badge>

          <h1 className="animate-fade-up text-4xl font-bold leading-[1.1] tracking-tight delay-100 md:text-6xl">
            {t("titleA")}{" "}
            <span className="text-accent">{t("titleHighlight")}</span>
          </h1>

          <p className="max-w-md animate-fade-up text-lg leading-relaxed text-muted delay-200">
            {t("subtitle")}
          </p>

          <div className="flex animate-fade-up flex-col gap-3 delay-300 sm:flex-row">
            <StartCta size="lg" />
            <Link href="/login">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                {tCta("login")}
              </Button>
            </Link>
          </div>

          <p className="text-xs text-subtle">{t("disclaimer")}</p>
        </div>

        {/* Demonstração — conversa antes/depois */}
        <div className="animate-fade-up delay-200">
          <ChatDemo />
        </div>
      </div>
    </section>
  );
}

function ChatDemo() {
  const t = useTranslations("landing.hero.demo");

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
        <span className="text-xs font-medium text-muted">{t("header")}</span>
      </div>

      <div className="space-y-3">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-overlay px-4 py-2.5 text-sm text-foreground">
          {t("received")}
        </div>

        <div className="rounded-xl border border-accent/25 bg-accent-muted p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t("suggestionLabel")}
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {t("suggestion")}
          </p>
        </div>

        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
          {t("sent")}
        </div>

        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-overlay px-4 py-2.5 text-sm text-foreground">
          {t("reply")}
          <span className="ml-1" aria-hidden>
            😄
          </span>
        </div>
      </div>
    </div>
  );
}
