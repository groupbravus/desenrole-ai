import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * LEITURA DE ACESSO PREMIUM (lado da aplicação)
 * ============================================================
 * A aplicação decide Premium SOMENTE por `entitlements.granted_until >
 * now()`. NUNCA consulta a Stripe em tempo de request.
 *
 * Usa o client do próprio usuário (RLS: cada um lê só a própria linha).
 * Não precisa de service_role — é leitura.
 * ============================================================
 */

const PREMIUM_FEATURE = "premium";

/** true se o usuário autenticado tem Premium ativo agora. */
export async function hasPremiumAccess(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("entitlements")
    .select("granted_until")
    .eq("user_id", user.id)
    .eq("feature", PREMIUM_FEATURE)
    .maybeSingle();

  if (!data?.granted_until) return false;
  return new Date(data.granted_until).getTime() > Date.now();
}

export interface SubscriptionSummary {
  premiumActive: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  grantedUntil: string | null;
}

/** Resumo da assinatura do usuário para a UI (só leitura do próprio). */
export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const empty: SubscriptionSummary = {
    premiumActive: false,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    grantedUntil: null,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const [{ data: ent }, { data: sub }] = await Promise.all([
    supabase
      .from("entitlements")
      .select("granted_until")
      .eq("user_id", user.id)
      .eq("feature", PREMIUM_FEATURE)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const grantedUntil = ent?.granted_until ?? null;
  return {
    premiumActive: grantedUntil
      ? new Date(grantedUntil).getTime() > Date.now()
      : false,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    grantedUntil,
  };
}
