"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPublicCheckoutSessionAction } from "@/lib/stripe/actions";

/**
 * CTA do card Premium na seção de preços — implementação própria, distinta
 * do <StartCta> (que continua levando ao quiz externo em hero/ferramentas/
 * CTA final). Cria a Checkout Session Live no backend e redireciona para o
 * checkout hospedado da Stripe, na mesma aba.
 *
 * Anti-duplo-clique: mesmo padrão do <SubscribeButton> — desabilita e entra
 * em loading no clique, só volta ao normal em caso de erro.
 */
export function PricingCheckoutButton({
  size = "lg",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tCta = useTranslations("landing.cta");
  const tErrors = useTranslations("auth.errors");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const result = await createPublicCheckoutSessionAction();
    if (result.ok) {
      // Redireciona para checkout.stripe.com na mesma aba. Não reseta o
      // loading: a navegação assume o controle.
      window.location.assign(result.url);
      return;
    }

    setError(
      result.code === "not_configured"
        ? tCta("unavailable")
        : tErrors("unknown"),
    );
    setLoading(false);
  }

  return (
    <div className={className}>
      <Button
        onClick={handleClick}
        disabled={loading}
        size={size}
        className="w-full sm:w-auto"
      >
        {tCta("start")}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="h-4 w-4" aria-hidden />
        )}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
