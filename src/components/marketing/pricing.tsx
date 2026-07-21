import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { StartCta } from "@/components/marketing/start-cta";
import type { PremiumPrice } from "@/lib/data/billing.supabase";

/**
 * Pricing da landing — V1: plano único Premium.
 *
 * A landing é pública. O CTA leva ao quiz EXTERNO (porta de entrada); a
 * conta e o checkout acontecem nesse fluxo externo, nunca aqui.
 */
export function Pricing({ price }: { price: PremiumPrice | null }) {
  const t = useTranslations("landing.pricing");
  const tp = useTranslations("plans");
  const locale = useLocale();

  const amount = price?.unitAmount ?? 990;
  const currency = price?.currency ?? "usd";
  const featureKeys = price?.featureKeys ?? [
    "allTools",
    "games",
    "history",
    "priority",
  ];

  return (
    <section id="pricing" className="border-y border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-muted">{t("subtitle")}</p>
        </div>

        <div className="mx-auto max-w-md">
          <div className="relative rounded-2xl border border-accent/40 bg-surface p-8 shadow-[0_0_40px_rgba(230,162,60,0.08)]">
            <h3 className="text-lg font-semibold">{tp("premium.name")}</h3>
            <p className="mt-1 text-sm text-muted">{tp("premium.description")}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-bold tracking-tight">
                {formatCurrency(amount, currency, locale)}
              </span>
              <span className="text-sm text-subtle">/{t("interval.month")}</span>
            </p>

            <ul className="mt-7 space-y-3">
              {featureKeys.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                    aria-hidden
                  />
                  <span className="text-muted">{tp(`features.${f}`)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <StartCta size="lg" className="block" />
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-subtle">{t("guarantee")}</p>
      </div>
    </section>
  );
}
