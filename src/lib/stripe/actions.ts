"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "./customer";
import { syncSubscription } from "./sync";
import { hasPremiumAccess } from "@/lib/entitlements";

/**
 * ============================================================
 * SERVER ACTIONS — CHECKOUT (S2)
 * ============================================================
 * - Só usuário autenticado cria checkout.
 * - Usa exclusivamente STRIPE_MONTHLY_PRICE_ID (1 item, quantity 1).
 * - Sem trial, sem promotion_codes, sem coleta de cartão pela app.
 * - O retorno do checkout NUNCA libera Premium: quem concede é o
 *   syncSubscription relendo a Stripe.
 * ============================================================
 */

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; code: string };

export async function createCheckoutSessionAction(): Promise<CheckoutResult> {
  const priceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  if (!priceId) return { ok: false, code: "not_configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: "not_authenticated" };

  // Já é Premium? Não faz sentido abrir novo checkout.
  if (await hasPremiumAccess()) return { ok: false, code: "already_premium" };

  const admin = createAdminClient();
  const stripe = getStripe();

  // Reaproveita uma sessão aberta e ainda válida, se houver (evita criar
  // múltiplas sessões por cliques repetidos).
  const { data: openRow } = await admin
    .from("checkout_sessions")
    .select("stripe_checkout_session_id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openRow?.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        openRow.stripe_checkout_session_id,
      );
      if (existing.status === "open" && existing.url) {
        return { ok: true, url: existing.url };
      }
      // Não está mais aberta: marca e segue para criar nova.
      await admin
        .from("checkout_sessions")
        .update({ status: existing.status === "expired" ? "expired" : "complete" })
        .eq("stripe_checkout_session_id", existing.id);
    } catch {
      // Sessão sumiu da Stripe: ignora e cria nova.
    }
  }

  const locale = await getLocale();
  const origin = await getOrigin();
  const customerId = await getOrCreateStripeCustomer({
    userId: user.id,
    email: user.email,
  });

  const environment =
    process.env.NODE_ENV === "production" ? "production" : "development";

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: false,
      metadata: {
        user_id: user.id,
        plan_slug: "premium",
        environment,
      },
      subscription_data: {
        metadata: { user_id: user.id, plan_slug: "premium" },
      },
      success_url: `${origin}/${locale}/checkout/processando?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${locale}/checkout/cancelado`,
    },
    { idempotencyKey: `checkout_${user.id}_${priceId}` },
  );

  if (!session.url) return { ok: false, code: "no_session_url" };

  await admin.from("checkout_sessions").insert({
    stripe_checkout_session_id: session.id,
    user_id: user.id,
    stripe_price_id: priceId,
    status: "open",
  });

  return { ok: true, url: session.url };
}

/**
 * Reconciliação no retorno do checkout — APENAS uma tentativa de sync.
 * Valida que a sessão pertence ao usuário e chama syncSubscription, que
 * relê a Stripe. Não concede Premium por si só.
 */
export async function reconcileCheckoutReturnAction(input: {
  sessionId: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // A sessão precisa pertencer a este usuário (RLS: lê só a própria).
  const { data: own } = await supabase
    .from("checkout_sessions")
    .select("stripe_checkout_session_id")
    .eq("stripe_checkout_session_id", input.sessionId)
    .maybeSingle();
  if (!own) return { ok: false };

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(input.sessionId);
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);
    if (!subId) return { ok: false };

    // Vincula a sessão à assinatura e marca como concluída.
    const admin = createAdminClient();
    await admin
      .from("checkout_sessions")
      .update({ status: "complete", stripe_subscription_id: subId })
      .eq("stripe_checkout_session_id", session.id);

    await syncSubscription({ subscriptionId: subId, source: "checkout_return" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Estado atual de acesso Premium (para o polling da tela de sucesso). */
export async function checkPremiumStatusAction(): Promise<{ premium: boolean }> {
  return { premium: await hasPremiumAccess() };
}
