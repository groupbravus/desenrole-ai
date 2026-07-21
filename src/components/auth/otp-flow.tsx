"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Mail } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { AuthCard } from "./auth-card";
import { AuthError } from "./auth-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  requestCheckoutOtpAction,
  verifyCheckoutOtpAction,
} from "@/lib/stripe/account-actions";

/**
 * Confirmação de posse do e-mail pago, via código OTP nativo do Supabase.
 * O e-mail vem do servidor (da Checkout Session) — só para EXIBIÇÃO, o
 * cliente nunca o envia de volta; as actions recebem apenas o sessionId.
 *
 * Passo 1: solicitar código. Passo 2: digitar o código. Ao verificar com
 * sucesso, o servidor já autenticou e reivindicou a sessão — aqui só
 * fazemos router.refresh() para o /criar-conta (Server Component) se
 * re-renderizar e mostrar o formulário de nome/senha automaticamente.
 */
export function OtpFlow({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  const t = useTranslations("createAccount.otp");
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setErrorCode(null);
    const result = await requestCheckoutOtpAction({ sessionId });
    setLoading(false);
    if (!result.ok) {
      setErrorCode(result.code);
      return;
    }
    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorCode(null);
    const result = await verifyCheckoutOtpAction({ sessionId, code });
    if (!result.ok) {
      setLoading(false);
      setErrorCode(result.code);
      return;
    }
    // Autenticado + sessão reivindicada: recarrega a página server para
    // avançar ao formulário de nome/senha.
    router.refresh();
  }

  if (step === "request") {
    return (
      <AuthCard eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")}>
        <div className="space-y-4">
          <AuthError code={errorCode} />
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-overlay px-3 py-2.5 text-sm text-muted">
            <Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            {email}
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSend}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {loading ? t("sending") : t("sendCta")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={t("eyebrow")}
      title={t("verifyTitle")}
      subtitle={t("verifySubtitle", { email })}
    >
      <form onSubmit={handleVerify} className="space-y-4" noValidate>
        <AuthError code={errorCode} />

        <FormField label={t("codeLabel")} htmlFor="otp-code">
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t("codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            maxLength={8}
          />
        </FormField>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {loading ? t("verifying") : t("verifyCta")}
        </Button>

        <button
          type="button"
          className="w-full text-center text-sm text-muted hover:text-foreground disabled:opacity-50"
          onClick={handleSend}
          disabled={loading}
        >
          {t("resend")}
        </button>
      </form>
    </AuthCard>
  );
}
