"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { Button } from "@/components/ui/button";
import { linkCheckoutToCurrentUserAction } from "@/lib/stripe/account-actions";

/**
 * Usuário JÁ logado, com o mesmo e-mail que pagou: vincula a assinatura à
 * conta e entra no painel. O vínculo em si é validado no servidor (relê a
 * Stripe e exige e-mail idêntico).
 */
export function LinkCheckout({ sessionId }: { sessionId: string }) {
  const t = useTranslations("createAccount.link");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleLink() {
    if (loading) return;
    setLoading(true);
    setErrorCode(null);
    const result = await linkCheckoutToCurrentUserAction({ sessionId });
    if (result.ok) {
      router.replace("/painel");
      router.refresh();
      return;
    }
    setErrorCode(result.code);
    setLoading(false);
  }

  return (
    <AuthCard eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")}>
      <div className="space-y-3">
        <AuthError code={errorCode} />
        <Button
          className="w-full"
          size="lg"
          onClick={handleLink}
          disabled={loading}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {loading ? t("linking") : t("cta")}
        </Button>
      </div>
    </AuthCard>
  );
}
