import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  const t = useTranslations("landing.finalCta");

  return (
    <section className="relative overflow-hidden border-t border-border py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-[100px]"
      />
      <div className="relative mx-auto max-w-2xl px-5 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted">{t("subtitle")}</p>
        <Link href="/quiz" className="mt-8 inline-block">
          <Button size="lg">
            {t("cta")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </section>
  );
}
