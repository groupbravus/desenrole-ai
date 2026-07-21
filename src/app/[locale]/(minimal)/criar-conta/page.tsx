import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateCheckoutForSignup,
  PENDING_CHECKOUT_COOKIE,
} from "@/lib/stripe/checkout-account";
import { AuthCard } from "@/components/auth/auth-card";
import { CreateAccountForm } from "@/components/auth/create-account-form";
import { LinkCheckout } from "@/components/auth/link-checkout";
import { BeginLinkButton } from "@/components/auth/begin-link-button";

export const metadata: Metadata = {
  title: "Criar conta — Desenrole.ai",
};

/**
 * /criar-conta — única porta de criação de conta. Só funciona a partir de
 * uma Checkout Session PAGA (validada direto na Stripe). Estados:
 *  - sessão inválida/não paga → mensagem de erro;
 *  - logado com o mesmo e-mail → vincula assinatura e entra;
 *  - logado com outro e-mail → bloqueia (não vincula a conta errada);
 *  - sessão já consumida → pede login;
 *  - caso novo → formulário nome/senha.
 * O session_id vem da URL (retorno do checkout) ou de um cookie httpOnly
 * (quando volta do login para vincular).
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

  // Logado: vincula (se o e-mail bater) ou bloqueia (se for outro).
  if (user) {
    if ((user.email ?? "").toLowerCase() === v.email) {
      return <LinkCheckout sessionId={v.sessionId} />;
    }
    return (
      <AuthCard
        eyebrow={t("mismatch.eyebrow")}
        title={t("mismatch.title")}
        subtitle={t("mismatch.subtitle")}
      >
        <Link
          href="/"
          className="block text-center text-sm font-medium text-accent hover:underline"
        >
          {t("mismatch.backHome")}
        </Link>
      </AuthCard>
    );
  }

  // Não logado: sessão já usada por uma conta → pedir login para vincular.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("checkout_sessions")
    .select("user_id")
    .eq("stripe_checkout_session_id", v.sessionId)
    .maybeSingle();

  if (existing) {
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

  // Caso novo: formulário de criação (e-mail vem da Stripe, só leitura).
  return <CreateAccountForm sessionId={v.sessionId} email={v.email} />;
}
