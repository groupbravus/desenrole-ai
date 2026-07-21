import "server-only";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Obtém (ou cria) o Stripe Customer ligado ao usuário. Server-only.
 *
 * Anti-duplicidade em três camadas:
 *  1. Consulta `stripe_customers` antes de criar.
 *  2. `stripe_customer_id` é UNIQUE no banco.
 *  3. Idempotency-Key determinística na criação (por user_id) — um duplo
 *     clique/retry não gera dois Customers na Stripe.
 *
 * A escrita em `stripe_customers` usa service_role (tabela não-gravável
 * pelo cliente). Só é chamado por código de servidor já autorizado.
 */
export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email: string;
}): Promise<string> {
  const admin = createAdminClient();

  // 1. Já existe mapeamento?
  const { data: existing } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // 2. Cria na Stripe com idempotency key determinística.
  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: input.email,
      metadata: { user_id: input.userId },
    },
    { idempotencyKey: `customer_create_${input.userId}` },
  );

  // 3. Persiste o mapeamento. Em corrida, o UNIQUE protege: se outra
  //    requisição inseriu antes, relemos o valor canônico.
  const { error } = await admin
    .from("stripe_customers")
    .insert({ user_id: input.userId, stripe_customer_id: customer.id });

  if (error) {
    const { data: raced } = await admin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", input.userId)
      .maybeSingle();
    if (raced?.stripe_customer_id) return raced.stripe_customer_id;
    throw error;
  }

  return customer.id;
}
