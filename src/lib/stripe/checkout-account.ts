import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ============================================================
 * VALIDAÇÃO DA CHECKOUT SESSION PARA CRIAÇÃO DE CONTA
 * ============================================================
 * A conta pós-checkout só pode ser criada a partir de uma sessão que a
 * PRÓPRIA Stripe confirme como paga e válida. Nunca confiamos no cliente:
 * o session_id vem do retorno, mas todo o resto é relido aqui.
 *
 * Checa: sessão existe, mode=subscription, status=complete, pagamento
 * pago, subscription presente, customer presente, e-mail do cliente
 * presente. Retorna os dados normalizados ou um código de erro.
 * ============================================================
 */

/** Cookie httpOnly que carrega o session_id através do login (link flow). */
export const PENDING_CHECKOUT_COOKIE = "desenrole_pending_checkout";

export type ValidatedCheckout = {
  ok: true;
  sessionId: string;
  email: string;
  customerId: string;
  subscriptionId: string;
};

export type CheckoutValidationError = {
  ok: false;
  code:
    | "invalid_session"
    | "not_paid"
    | "no_subscription"
    | "no_customer"
    | "no_email";
};

function idOf(v: string | { id: string } | null): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

export async function validateCheckoutForSignup(
  sessionId: string | null | undefined,
): Promise<ValidatedCheckout | CheckoutValidationError> {
  if (!sessionId || typeof sessionId !== "string") {
    return { ok: false, code: "invalid_session" };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return { ok: false, code: "invalid_session" };
  }

  if (session.mode !== "subscription" || session.status !== "complete") {
    return { ok: false, code: "invalid_session" };
  }
  // Pagamento confirmado — assinatura sem `paid` não libera conta.
  if (session.payment_status !== "paid") {
    return { ok: false, code: "not_paid" };
  }

  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) return { ok: false, code: "no_subscription" };

  const customerId = idOf(session.customer);
  if (!customerId) return { ok: false, code: "no_customer" };

  const email =
    session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) return { ok: false, code: "no_email" };

  return {
    ok: true,
    sessionId: session.id,
    email: email.toLowerCase(),
    customerId,
    subscriptionId,
  };
}

/**
 * true SOMENTE se já existe uma conta REAL (com senha) para o e-mail. Uma
 * conta criada via OTP mas ainda sem senha (usuário no meio do próprio
 * fluxo de /criar-conta) não conta — isso evita bloquear a própria pessoa
 * que está terminando o cadastro. Ver RPC `email_has_account` (SQL) para
 * o critério exato (encrypted_password).
 */
export async function emailHasAccount(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_has_account", {
    _email: email,
  });
  if (error) throw new Error("email_has_account_failed");
  return Boolean(data);
}

export type ClaimResult = { claimed: boolean; ownerUserId: string | null };

/**
 * Reivindicação ATÔMICA da Checkout Session (RPC `claim_checkout_session`,
 * INSERT ... ON CONFLICT DO NOTHING no banco). Duas chamadas concorrentes
 * para o mesmo sessionId: só uma vence; a outra lê o dono real. Chamar de
 * novo com o MESMO userId que já é dono é seguro (retomada idempotente).
 */
export async function claimCheckoutSession(
  admin: SupabaseClient,
  sessionId: string,
  userId: string,
): Promise<ClaimResult> {
  const { data, error } = await admin
    .rpc("claim_checkout_session", { _session_id: sessionId, _user_id: userId })
    .single<{ claimed: boolean; owner_user_id: string | null }>();
  if (error || !data) throw new Error("claim_checkout_session_failed");
  return { claimed: data.claimed, ownerUserId: data.owner_user_id };
}

/** true se `userId` é (ou acabou de se tornar) o dono legítimo da sessão. */
export function ownsClaim(claim: ClaimResult, userId: string): boolean {
  return claim.claimed || claim.ownerUserId === userId;
}
