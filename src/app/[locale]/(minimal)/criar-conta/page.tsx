import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  validateCheckoutForSignup,
  emailHasAccount,
  PENDING_CHECKOUT_COOKIE,
} from "@/lib/stripe/checkout-account";
import { AuthCard } from "@/components/auth/auth-card";
import { AccountMismatch } from "@/components/auth/account-mismatch";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { LinkCheckout } from "@/components/auth/link-checkout";
import { BeginLinkButton } from "@/components/auth/begin-link-button";
import { OtpFlow } from "@/components/auth/otp-flow";

export const metadata: Metadata = {
  title: "Criar conta — Desenrole.ai",
};

/**
 * /criar-conta — única porta de criação de conta, e SÓ a partir de uma
 * Checkout Session PAGA (revalidada direto na Stripe a cada render).
 *
 * Decisão determinística (reload-safe, sem inferir estado do React):
 *  1. sessão inválida/não paga -> erro.
 *  2. autenticado com e-mail DIFERENTE do que pagou -> bloqueia (sair).
 *  3. `emailHasAccount` (true só p/ conta com SENHA real, nunca uma
 *     conta OTP ainda sem senha — por isso não trava o próprio usuário
 *     no meio do fluxo):
 *       - true + autenticado  -> vincular (LinkCheckout).
 *       - true + visitante    -> "já tem conta" (login).
 *       - false + autenticado -> definir nome/senha (CreateAccountForm).
 *       - false + visitante   -> confirmar e-mail por OTP (OtpFlow).
 */
export default async function CriarContaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const urlSession = typeof sp.session_id === "string" ? sp.session_id : null;
  const cookieSession =
    (await cookies()).get(PENDING_CHECKOUT_COOKIE)?.value ?? null;
  const sessionId = urlSession ?? cookieSession;

  const t = await getTranslations("createAccount");
  const v = await validateCheckoutForSignup(sessionId);

  if (!v.ok) {
    return (
      <AuthCard
        eyebrow={t("invalid.eyebrow")}
        title={t("invalid.title")}
        subtitle={t(`errors.${v.code}`)}
      >
        <Link
          href="/"
          className="block text-center text-sm font-medium text-accent hover:underline"
        >
          {t("invalid.backHome")}
        </Link>
      </AuthCard>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (user.email ?? "").toLowerCase() !== v.email) {
    return <AccountMismatch />;
  }

  const hasAccount = await emailHasAccount(v.email);

  if (hasAccount) {
    if (user) return <LinkCheckout sessionId={v.sessionId} />;
    return (
      <AuthCard
        eyebrow={t("emailExists.eyebrow")}
        title={t("emailExists.title")}
        subtitle={t("emailExists.subtitle")}
      >
        <BeginLinkButton sessionId={v.sessionId} label={t("emailExists.cta")} />
      </AuthCard>
    );
  }

  if (user) return <CreateAccountForm sessionId={v.sessionId} email={v.email} />;
  return <OtpFlow sessionId={v.sessionId} email={v.email} />;
}
