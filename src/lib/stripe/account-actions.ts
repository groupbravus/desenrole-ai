"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "./sync";
import {
  validateCheckoutForSignup,
  emailHasAccount,
  claimCheckoutSession,
  ownsClaim,
  PENDING_CHECKOUT_COOKIE,
} from "./checkout-account";

/**
 * ============================================================
 * CRIAÇÃO / VÍNCULO DE CONTA A PARTIR DO CHECKOUT (server actions)
 * ============================================================
 * A conta nunca é criada por Admin API aqui — o usuário nasce pelo fluxo
 * NATIVO de OTP do Supabase (signInWithOtp/verifyOtp). O e-mail vem
 * SEMPRE da Checkout Session validada na Stripe; o cliente nunca o
 * informa nem pode alterá-lo.
 *
 * Ordem de segurança (após verificação do OTP):
 *   1. relê a Checkout Session na Stripe
 *   2. confirma que o e-mail autenticado == e-mail da Stripe
 *   3. claim atômico da sessão (RPC) — perdedor recebe
 *      CHECKOUT_ALREADY_CLAIMED
 *   4. só então: nome, senha, vínculo customer/subscription, sync
 *
 * O webhook (`api/webhooks/stripe`) permanece inalterado: nunca cria
 * conta, nunca define senha, nunca envia convite — só sincroniza.
 * ============================================================
 */

type Result = { ok: true } | { ok: false; code: string };

function mapOtpError(error: { code?: string } | null | undefined): string {
  const code = error?.code;
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return "rate_limited";
  }
  if (code === "otp_expired") return "otp_expired";
  if (code === "invalid_credentials") return "otp_invalid";
  return "unknown";
}

function mapPasswordError(code: string | undefined): string {
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  return "unknown";
}

/**
 * Reivindica a sessão para `userId` (idempotente: retomada segura se já
 * era dele) ou devolve o erro de bloqueio se outro usuário já é dono.
 */
async function claimOrBlock(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "CHECKOUT_ALREADY_CLAIMED" }> {
  const claim = await claimCheckoutSession(admin, sessionId, userId);
  if (!ownsClaim(claim, userId)) {
    return { ok: false, code: "CHECKOUT_ALREADY_CLAIMED" };
  }
  return { ok: true };
}

/** Vincula customer+subscription (sessão já reivindicada) e sincroniza. */
async function linkStripeAndSync(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  customerId: string,
  subscriptionId: string,
  sessionId: string,
): Promise<Result> {
  const { error: custError } = await admin
    .from("stripe_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: "user_id" },
    );
  if (custError) return { ok: false, code: "unknown" };

  // UPDATE (não upsert): a linha já existe pelo claim; restringe a esta
  // sessão E a este dono, nunca toca a de outro usuário.
  const { error: sessError } = await admin
    .from("checkout_sessions")
    .update({ status: "complete", stripe_subscription_id: subscriptionId })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("user_id", userId);
  if (sessError) return { ok: false, code: "unknown" };

  const sync = await syncSubscription({
    subscriptionId,
    source: "checkout_return",
  });
  if (!sync.ok) return { ok: false, code: "sync_failed" };

  return { ok: true };
}

/**
 * Passo 1 (OTP): envia o código por e-mail. O e-mail vem EXCLUSIVAMENTE
 * da Checkout Session validada — nunca de input do cliente. Só envia se
 * ainda não existir conta REAL (com senha) para esse e-mail.
 */
export async function requestCheckoutOtpAction(input: {
  sessionId: string;
}): Promise<Result> {
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const v = await validateCheckoutForSignup(parsed.data.sessionId);
  if (!v.ok) return { ok: false, code: v.code };

  let hasAccount: boolean;
  try {
    hasAccount = await emailHasAccount(v.email);
  } catch {
    return { ok: false, code: "unknown" };
  }
  if (hasAccount) return { ok: false, code: "email_exists" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: v.email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, code: mapOtpError(error) };

  return { ok: true };
}

/**
 * Passo 2 (OTP): verifica o código, confirma o e-mail e reivindica a
 * sessão atomicamente. Depois disso o usuário está autenticado E a
 * sessão é dele — falta só nome/senha (finalizeAccountAction).
 */
export async function verifyCheckoutOtpAction(input: {
  sessionId: string;
  code: string;
}): Promise<Result> {
  const parsed = z
    .object({ sessionId: z.string().min(1), code: z.string().min(6).max(8) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  // Relê a Stripe de novo — nunca confia no estado anterior.
  const v = await validateCheckoutForSignup(parsed.data.sessionId);
  if (!v.ok) return { ok: false, code: v.code };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: v.email,
    token: parsed.data.code,
    type: "email",
  });
  if (error) return { ok: false, code: mapOtpError(error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || (user.email ?? "").toLowerCase() !== v.email) {
    await supabase.auth.signOut();
    return { ok: false, code: "otp_invalid" };
  }

  const admin = createAdminClient();
  const claim = await claimOrBlock(admin, v.sessionId, user.id);
  if (!claim.ok) {
    // Sessão já é de outra conta: não deixa este login "solto" sem dono.
    await supabase.auth.signOut();
    return claim;
  }

  return { ok: true };
}

/**
 * Passo 3 (OTP): com o usuário já autenticado via OTP e a sessão já
 * reivindicada, define nome+senha e vincula customer/subscription.
 * Idempotente: retomada segura enquanto quem chama continuar sendo o
 * dono do claim (reclama de novo — no-op se já era dele).
 */
export async function finalizeAccountAction(input: {
  sessionId: string;
  name: string;
  password: string;
}): Promise<Result> {
  const parsed = z
    .object({
      sessionId: z.string().min(1),
      name: z.string().min(2),
      password: z.string().min(8),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: "not_authenticated" };

  const v = await validateCheckoutForSignup(parsed.data.sessionId);
  if (!v.ok) return { ok: false, code: v.code };
  if (user.email.toLowerCase() !== v.email) {
    return { ok: false, code: "email_mismatch" };
  }

  const admin = createAdminClient();
  const claim = await claimOrBlock(admin, v.sessionId, user.id);
  if (!claim.ok) return claim;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ name: parsed.data.name.trim() })
    .eq("id", user.id);
  if (profileError) return { ok: false, code: "unknown" };

  const { error: pwError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (pwError) return { ok: false, code: mapPasswordError(pwError.code) };

  const linked = await linkStripeAndSync(
    admin,
    user.id,
    v.customerId,
    v.subscriptionId,
    v.sessionId,
  );
  if (!linked.ok) return linked;

  (await cookies()).delete(PENDING_CHECKOUT_COOKIE);
  return { ok: true };
}

/**
 * Fluxo de conta JÁ EXISTENTE: usuário logado normalmente (senha), mesmo
 * e-mail que pagou. Reivindica (idempotente) e vincula — sem tocar em
 * senha/perfil, que já existem.
 */
export async function linkCheckoutToCurrentUserAction(input: {
  sessionId: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: "not_authenticated" };

  const v = await validateCheckoutForSignup(input.sessionId);
  if (!v.ok) return { ok: false, code: v.code };

  // Segurança: nunca vincular a assinatura de um e-mail a outra conta.
  if (user.email.toLowerCase() !== v.email) {
    return { ok: false, code: "email_mismatch" };
  }

  const admin = createAdminClient();
  const claim = await claimOrBlock(admin, v.sessionId, user.id);
  if (!claim.ok) return claim;

  const linked = await linkStripeAndSync(
    admin,
    user.id,
    v.customerId,
    v.subscriptionId,
    v.sessionId,
  );
  if (!linked.ok) return linked;

  (await cookies()).delete(PENDING_CHECKOUT_COOKIE);
  return { ok: true };
}

/**
 * E-mail já tem conta: guarda o session_id num cookie httpOnly e manda
 * para o login. Depois do login o usuário volta a /criar-conta, que lê o
 * cookie e faz o vínculo. (O `next` do login descarta query string, por
 * isso o cookie.)
 */
export async function beginLinkAction(input: {
  sessionId: string;
}): Promise<void> {
  const locale = await getLocale();
  const v = await validateCheckoutForSignup(input.sessionId);
  if (v.ok) {
    (await cookies()).set(PENDING_CHECKOUT_COOKIE, v.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 900,
    });
  }
  redirect(
    `/${locale}/login?next=${encodeURIComponent(`/${locale}/criar-conta`)}`,
  );
}
