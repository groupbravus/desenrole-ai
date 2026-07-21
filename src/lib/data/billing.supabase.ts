import { createClient } from "@/lib/supabase/server";

/**
 * Catálogo de preços — lê o plano ativo do banco (plan_prices é público:
 * leitura liberada a anon/authenticated). Fonte da verdade do preço
 * exibido na UI (V1: 1 plano Premium).
 */
export interface PremiumPrice {
  planId: string;
  featureKeys: string[];
  unitAmount: number; // centavos
  currency: string;
  interval: string;
}

export const billingRepository = {
  async getPremiumPrice(): Promise<PremiumPrice | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("plan_prices")
      .select("plan_id, unit_amount, currency, interval, plans(feature_keys)")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const plan = data.plans as unknown as { feature_keys: string[] } | null;
    return {
      planId: data.plan_id,
      featureKeys: plan?.feature_keys ?? [],
      unitAmount: data.unit_amount,
      currency: data.currency,
      interval: data.interval,
    };
  },
};
