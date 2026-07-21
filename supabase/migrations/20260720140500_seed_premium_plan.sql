-- ============================================================
-- STRIPE — seed do plano único da V1
-- ============================================================
-- Plano: Premium | Preço: US$ 9,90/mês | Moeda: USD | Mensal.
-- Somente este plano (escopo V1 congelado).
-- Idempotente (on conflict do nothing).
--
-- `stripe_price_id` = Stripe Price do plano Premium mensal.
-- Deve ser igual ao STRIPE_MONTHLY_PRICE_ID do ambiente.
-- DEV usa o Price de TESTE (Stripe Test Mode).
-- Price de produção/live (uso futuro): price_1TvOXEB3cMXjTDhl4AvrRizX
-- ============================================================

insert into public.plans (id, name_key, feature_keys, active, sort_order)
values (
  'premium',
  'premium',
  array['allTools', 'games', 'history', 'priority'],
  true,
  0
)
on conflict (id) do nothing;

insert into public.plan_prices (
  plan_id, stripe_price_id, stripe_product_id,
  unit_amount, currency, interval, active
)
values (
  'premium',
  'price_1Tvd3MB3cMXjTDhIsTcj4CV0',       -- Stripe Price de TESTE (= STRIPE_MONTHLY_PRICE_ID em dev)
  null,                                    -- stripe_product_id: preenchido na sincronização (S2/S3)
  990,                                     -- US$ 9,90 em centavos
  'usd',
  'month',
  true
)
on conflict (stripe_price_id) do nothing;
