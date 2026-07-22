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

export const metadata: Metadata = {
  title: "Criar conta — Desenrole.ai",
};

/**
 * /criar-conta — única porta de criação de conta, e SÓ a partir de uma
 * Checkout Session PAGA (revalidada direto na Stripe a cada render).
 *
 * Sem OTP: a conta nasce direto (nome + senha), com o e-mail vindo só da
 * Stripe. Decisão determinística (reload-safe, sem inferir estado do
 * React):
 *  1. sessão inválida/não paga -> erro.
 *  2. autenticado com e-mail DIFERENTE do que pagou -> bloqueia (sair).
 *  3. `emailHasAccount` (true só p/ conta com SENHA real — createUser é a
 *     ÚNICA via que grava senha, então isso nunca falso-positiva):
 *       - true + autenticado -> vincular/retomar (LinkCheckout).
 *       - true + visitante   -> "já tem conta" (login/recuperar senha).
 *       - false              -> formulário nome/senha (CreateAccountForm).
 *        (false + autenticado é inalcançável: sem OTP, só se autentica
 *         depois que createUser já gravou a senha real.)
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
        <div className="space-y-3">
          <BeginLinkButton sessionId={v.sessionId} label={t("emailExists.cta")} />
          <Link
            href="/recuperar-senha"
            className="block text-center text-sm text-muted hover:text-foreground"
          >
            {t("emailExists.forgotPassword")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return <CreateAccountForm sessionId={v.sessionId} email={v.email} />;
}
