import { useLocale, useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { SubscribeButton } from "./subscribe-button";
import type { PremiumPrice } from "@/lib/data/billing.supabase";
import type { SubscriptionSummary } from "@/lib/entitlements";

/**
 * Aba Assinatura (V1: plano único Premium).
 *
 * - Premium ativo → mostra o estado atual (e se está agendado p/ encerrar).
 * - Sem Premium → mostra o plano Premium (US$ 9,90/mês, do banco) + botão
 *   Assinar agora, que cria a sessão no backend e vai ao Checkout hospedado.
 *
 * Acesso é decidido por entitlements — nunca por dado da Stripe em request.
 */
export function SubscriptionTab({
  price,
  summary,
}: {
  price: PremiumPrice | null;
  summary: SubscriptionSummary;
}) {
  const t = useTranslations("settings.subscription");
  const tp = useTranslations("plans");
  const tInterval = useTranslations("landing.pricing.interval");
  const locale = useLocale();

  if (summary.premiumActive) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" aria-hidden />
              <span className="font-semibold text-foreground">
                {tp("premium.name")}
              </span>
              <Badge variant="success">{t("statusActive")}</Badge>
            </div>
            {summary.currentPeriodEnd && (
              <span className="text-xs text-subtle">
                {summary.cancelAtPeriodEnd
                  ? t("endsOn", {
                      date: formatDate(summary.currentPeriodEnd, locale),
                    })
                  : t("renewsOn", {
                      date: formatDate(summary.currentPeriodEnd, locale),
                    })}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {t("manageNote")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-accent/30 p-8">
        <Badge variant="accent" className="mb-4">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t("premiumEyebrow")}
        </Badge>
        <h3 className="text-lg font-semibold text-foreground">
          {tp("premium.name")}
        </h3>
        <p className="mt-1 text-sm text-muted">{tp("premium.description")}</p>

        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight">
            {price
              ? formatCurrency(price.unitAmount, price.currency, locale)
              : formatCurrency(990, "usd", locale)}
          </span>
          <span className="text-sm text-subtle">
            /{tInterval(price?.interval === "month" ? "month" : "month")}
          </span>
        </p>

        <ul className="mt-6 space-y-2.5">
          {(price?.featureKeys ?? ["allTools", "games", "history", "priority"]).map(
            (feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 text-sm text-muted"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  aria-hidden
                />
                {tp(`features.${feature}`)}
              </li>
            ),
          )}
        </ul>

        <div className="mt-7">
          <SubscribeButton />
        </div>
      </Card>

      <p className="text-center text-xs text-subtle">{t("hostedNote")}</p>
    </div>
  );
}
