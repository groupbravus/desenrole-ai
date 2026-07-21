import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { billingRepository } from "@/lib/data";
import { getSubscriptionSummary } from "@/lib/entitlements";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { SubscribeButton } from "@/components/settings/subscribe-button";

export const metadata: Metadata = {
  title: "Planos — Desenrole.ai",
};

/**
 * Página de planos/checkout — destino de quem está autenticado mas sem
 * assinatura ativa (o gate `requirePremium` manda pra cá). Fica FORA do
 * grupo (premium), então é acessível sem assinatura. Se já é premium,
 * não há o que assinar → vai para o painel.
 */
export default async function PlanosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireUser();
  const [summary, price] = await Promise.all([
    getSubscriptionSummary(),
    billingRepository.getPremiumPrice(),
  ]);

  if (summary.premiumActive) redirect(`/${locale}/painel`);

  const t = await getTranslations("planos");
  const tp = await getTranslations("plans");
  const ts = await getTranslations("settings.subscription");
  const tInterval = await getTranslations("landing.pricing.interval");

  const featureKeys = price?.featureKeys ?? [
    "allTools",
    "games",
    "history",
    "priority",
  ];

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted">{t("subtitle")}</p>
      </div>

      <Card className="relative overflow-hidden border-accent/30 p-8">
        <Badge variant="accent" className="mb-4">
          <Sparkles className="h-3 w-3" aria-hidden />
          {ts("premiumEyebrow")}
        </Badge>
        <h2 className="text-lg font-semibold text-foreground">
          {tp("premium.name")}
        </h2>
        <p className="mt-1 text-sm text-muted">{tp("premium.description")}</p>

        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold tracking-tight">
            {price
              ? formatCurrency(price.unitAmount, price.currency, locale)
              : formatCurrency(990, "usd", locale)}
          </span>
          <span className="text-sm text-subtle">/{tInterval("month")}</span>
        </p>

        <ul className="mt-6 space-y-2.5">
          {featureKeys.map((feature) => (
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
          ))}
        </ul>

        <div className="mt-7">
          <SubscribeButton />
        </div>
      </Card>

      <p className="text-center text-xs text-subtle">{ts("hostedNote")}</p>
    </div>
  );
}
