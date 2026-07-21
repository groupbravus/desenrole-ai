import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveGrantedUntil,
  shouldApplyEvent,
  type SubscriptionStatus,
} from "./entitlement-logic";

/**
 * ============================================================
 * syncSubscription — FUNÇÃO CENTRAL DE SINCRONIZAÇÃO (server-only)
 * ============================================================
 * Chamada por: webhook, retorno do checkout, cron (futuro) e admin
 * (futuro), SEM ordem entre si. Quem chegar primeiro sincroniza; os
 * demais convergem para o mesmo estado.
 *
 * REGRA PRINCIPAL: o evento é só um SINAL. Aqui relê-se o estado ATUAL
 * da assinatura na Stripe antes de persistir — nunca se confia no
 * payload recebido.
 *
 * Escreve com service_role (tabelas financeiras não são graváveis pelo
 * cliente). Idempotente. Guarda contra eventos fora de ordem via
 * `subscriptions.latest_event_at` (concorrência otimista). NOTA S4: um
 * advisory lock transacional (função SQL) é o endurecimento recomendado
 * para corridas de altíssima frequência; a guarda atual já impede
 * regressão de estado e duplicação de período.
 * ============================================================
 */

export type SyncSource = "webhook" | "checkout_return" | "cron" | "admin";

export type SyncResult =
  | { ok: true; userId: string; skipped?: "out_of_order" }
  | { ok: false; reason: string };

const PREMIUM_FEATURE = "premium";

function toDate(unixSeconds: number | null | undefined): Date | null {
  return unixSeconds ? new Date(unixSeconds * 1000) : null;
}

export async function syncSubscription(input: {
  subscriptionId: string;
  source: SyncSource;
  eventId?: string;
  eventAt?: Date;
}): Promise<SyncResult> {
  const admin = createAdminClient();
  const stripe = getStripe();

  // 1. RELÊ o estado atual na Stripe (fonte da verdade).
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(input.subscriptionId);
  } catch {
    return { ok: false, reason: "subscription_not_found_in_stripe" };
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const metaUserId =
    typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;

  // 2. Identifica o usuário com segurança (mapeamento primário +
  //    metadata como reforço/criação do mapeamento).
  const { data: mapping } = await admin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  let userId: string | null = mapping?.user_id ?? null;

  if (!userId && metaUserId) {
    await admin
      .from("stripe_customers")
      .upsert(
        { user_id: metaUserId, stripe_customer_id: customerId },
        { onConflict: "user_id" },
      );
    userId = metaUserId;
  }

  if (!userId) return { ok: false, reason: "user_not_identified" };

  // 3. Guarda contra evento fora de ordem.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("status, latest_event_at")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

  const eventAt = input.eventAt ?? new Date();
  const lastSyncedAt = existing?.latest_event_at
    ? new Date(existing.latest_event_at)
    : null;

  if (!shouldApplyEvent(eventAt, lastSyncedAt)) {
    return { ok: true, userId, skipped: "out_of_order" };
  }

  const status = sub.status as SubscriptionStatus;
  const currentPeriodEnd = toDate(sub.current_period_end);
  const priceId = sub.items.data[0]?.price.id ?? null;

  // 4. Upsert idempotente do espelho da assinatura.
  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      stripe_subscription_id: sub.id,
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      status,
      current_period_start: toDate(sub.current_period_start)?.toISOString() ?? null,
      current_period_end: currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: sub.cancel_at_period_end,
      canceled_at: toDate(sub.canceled_at)?.toISOString() ?? null,
      trial_end: toDate(sub.trial_end)?.toISOString() ?? null,
      latest_event_at: eventAt.toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (subError) return { ok: false, reason: "subscription_upsert_failed" };

  // 5. Recalcula o entitlement (fonte única da decisão de Premium).
  const grantedUntil = deriveGrantedUntil({ status, currentPeriodEnd });

  const { data: prevEnt } = await admin
    .from("entitlements")
    .select("granted_until")
    .eq("user_id", userId)
    .eq("feature", PREMIUM_FEATURE)
    .maybeSingle();

  const { error: entError } = await admin.from("entitlements").upsert(
    {
      user_id: userId,
      feature: PREMIUM_FEATURE,
      granted_until: grantedUntil?.toISOString() ?? null,
      source: "subscription",
      source_ref: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,feature" },
  );
  if (entError) return { ok: false, reason: "entitlement_upsert_failed" };

  // 6. Trilha de auditoria.
  await admin.from("subscription_sync_log").insert({
    stripe_subscription_id: sub.id,
    source: input.source,
    event_id: input.eventId ?? null,
    status_before: existing?.status ?? null,
    status_after: status,
    entitlement_before: prevEnt?.granted_until ?? null,
    entitlement_after: grantedUntil?.toISOString() ?? null,
  });

  return { ok: true, userId };
}
