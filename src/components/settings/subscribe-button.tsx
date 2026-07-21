"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction } from "@/lib/stripe/actions";

/**
 * Botão "Assinar agora". Cria a Checkout Session no backend e redireciona
 * para o checkout hospedado da Stripe.
 *
 * Anti-duplo-clique: desabilita e entra em loading no primeiro clique, e
 * só volta ao normal em caso de erro (no sucesso, a página navega para a
 * Stripe). Assim um clique repetido não dispara múltiplos fluxos.
 */
export function SubscribeButton() {
  const t = useTranslations("settings.subscription");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const result = await createCheckoutSessionAction();
    if (result.ok) {
      // Redireciona para checkout.stripe.com. Não reseta o loading:
      // a navegação assume o controle.
      window.location.assign(result.url);
      return;
    }

    setError(t(`errors.${result.code}`));
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSubscribe}
        disabled={loading}
        size="lg"
        className="w-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden />
        )}
        {loading ? t("redirecting") : t("subscribeCta")}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
