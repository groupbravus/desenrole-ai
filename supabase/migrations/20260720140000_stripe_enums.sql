-- ============================================================
-- STRIPE — enums de domínio
-- ============================================================
-- Espelham os valores da Stripe (integridade em vez de text solto).
-- Base para todas as tabelas de pagamento (aditivas; não tocam a
-- fundação congelada).
-- ============================================================

-- Intervalos de cobrança (Stripe: day/week/month/year). V1 usa 'month'.
create type public.billing_interval as enum ('day', 'week', 'month', 'year');

-- Status de assinatura — valor cru vindo da Stripe.
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

-- Origem de um entitlement (acesso derivado).
create type public.entitlement_source as enum ('subscription', 'trial', 'manual');

-- Estado de uma Checkout Session.
create type public.checkout_session_status as enum ('open', 'complete', 'expired');

-- Estado de processamento de um webhook.
create type public.webhook_process_status as enum (
  'received', 'processed', 'skipped', 'error'
);

-- Quem disparou uma sincronização (auditoria).
create type public.sync_source as enum (
  'webhook', 'checkout_return', 'cron', 'admin'
);
