import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

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
