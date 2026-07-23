import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Check } from "lucide-react";
import { plansRepository } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("adminPlanos") };
}

export default async function AdminPlanosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const plans = await plansRepository.getActivePlans();
  const t = await getTranslations("admin.plans");
  const tp = await getTranslations("plans");
  const tInterval = await getTranslations("landing.pricing.interval");
  const currentLocale = await getLocale();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                {tp(`${plan.slug}.name`)}
              </h3>
              {plan.recommended && (
                <Badge variant="accent">{t("recommended")}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {tp(`${plan.slug}.description`)}
            </p>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight">
                {formatCurrency(plan.priceInCents, plan.currency, currentLocale)}
              </span>
              <span className="text-sm text-subtle">
                /{tInterval(plan.interval)}
              </span>
            </p>
            <ul className="mt-4 space-y-2">
              {plan.featureKeys.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-muted"
                >
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                    aria-hidden
                  />
                  {tp(`features.${f}`)}
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-6 w-full" disabled>
              {t("editPlan")}
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-center text-xs text-subtle">{t("editNote")}</p>
    </div>
  );
}
