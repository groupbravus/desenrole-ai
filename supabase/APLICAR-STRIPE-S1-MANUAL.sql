-- ============================================================
-- APLICAÇÃO MANUAL — Fase Stripe S1 (SQL Editor do Supabase)
-- Projeto: desenrole-gringa-dev (mwpxxxwkvceeobaurgls)
-- ============================================================
-- Cole tudo e execute UMA vez. Cria 6 enums + 8 tabelas + índices
-- + RLS + seed do plano Premium (Price de TESTE — Stripe Test Mode).
-- NÃO é reexecutável (usa create table/type). Para reaplicar,
-- rode antes o ROLLBACK-STRIPE-S1.sql.
-- ============================================================


-- ############ 20260720140000_stripe_enums.sql ############
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

-- ############ 20260720140100_stripe_catalog.sql ############
-- ============================================================
-- STRIPE — catálogo comercial: plans + plan_prices
-- ============================================================
-- `plans`       = "o que é" (produto comercial estável). V1: 1 plano.
-- `plan_prices` = "quanto custa" (espelho de Stripe Price).
--
-- Catálogo é informação PÚBLICA (a landing exibe preço sem login):
-- leitura liberada a anon + authenticated; escrita só service_role.
-- ============================================================

create table public.plans (
  id          text primary key,          -- slug estável, ex.: 'premium'
  name_key    text not null,             -- chave i18n
  feature_keys text[] not null default '{}',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.plans is
  'Catalogo comercial. V1: exatamente 1 plano (premium). Escrita so service_role.';

create table public.plan_prices (
  id                uuid primary key default gen_random_uuid(),
  plan_id           text not null references public.plans (id) on delete restrict,
  stripe_price_id   text not null unique,
  stripe_product_id text,
  unit_amount       integer not null check (unit_amount >= 0),  -- centavos
  currency          text not null,                              -- ex.: 'usd'
  interval          public.billing_interval not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.plan_prices is
  'Espelho de Stripe Price. unit_amount em centavos. Escrita so service_role.';

create index plan_prices_plan_id_idx on public.plan_prices (plan_id);
create index plan_prices_active_idx  on public.plan_prices (active);

-- updated_at automático (reusa a função da fundação).
create trigger plan_prices_set_updated_at
  before update on public.plan_prices
  for each row execute function public.set_updated_at();

-- ---------- Grants: catálogo é público ----------
revoke all on public.plans       from anon, authenticated;
revoke all on public.plan_prices from anon, authenticated;
grant select on public.plans       to anon, authenticated;
grant select on public.plan_prices to anon, authenticated;

-- ---------- RLS ----------
alter table public.plans       enable row level security;
alter table public.plan_prices enable row level security;

-- Leitura pública (qualquer papel). Escrita: nenhuma policy → só service_role.
create policy "plans_select_all"
  on public.plans for select
  using (true);

create policy "plan_prices_select_all"
  on public.plan_prices for select
  using (true);

-- ############ 20260720140200_stripe_customers.sql ############
-- ============================================================
-- STRIPE — stripe_customers (ponte auth.users ↔ Stripe Customer)
-- ============================================================
-- 1:1 com o usuário. O cliente pode LER o próprio; escrita só backend
-- (service_role) — a criação do Customer é operação de servidor.
-- ============================================================

create table public.stripe_customers (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.stripe_customers is
  'Mapa 1:1 usuario -> Stripe Customer. Escrita so service_role (backend).';

create trigger stripe_customers_set_updated_at
  before update on public.stripe_customers
  for each row execute function public.set_updated_at();

revoke all on public.stripe_customers from anon, authenticated;
grant select on public.stripe_customers to authenticated;

alter table public.stripe_customers enable row level security;

-- Só leitura do próprio (ou admin). Sem policy de escrita → só service_role.
create policy "stripe_customers_select_own_or_admin"
  on public.stripe_customers for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- ############ 20260720140300_stripe_subscriptions.sql ############
-- ============================================================
-- STRIPE — subscriptions (espelho) + entitlements (acesso derivado)
-- ============================================================
-- `subscriptions` = espelho da Stripe Subscription (a Stripe é a fonte
--   da verdade; isto é cópia local escrita só por syncSubscription).
-- `entitlements`  = direitos de acesso derivados. A aplicação consulta
--   APENAS esta tabela para decidir Premium (desacoplada da Stripe).
--
-- Cliente: SELECT próprio. Escrita: só service_role (backend). Nenhuma
-- policy de INSERT/UPDATE/DELETE + nenhum grant de escrita = dupla
-- barreira (mesmo modelo de user_roles).
-- ============================================================

create table public.subscriptions (
  stripe_subscription_id text primary key,
  user_id                uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_price_id        text,
  status                 public.subscription_status not null,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  canceled_at            timestamptz,
  trial_end              timestamptz,
  latest_event_at        timestamptz,   -- descarte de eventos out-of-order
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.subscriptions is
  'Espelho da Stripe Subscription. Fonte da verdade e a Stripe. '
  'Escrita so por syncSubscription (service_role). latest_event_at protege '
  'contra eventos fora de ordem.';

create index subscriptions_user_id_idx     on public.subscriptions (user_id);
create index subscriptions_status_idx      on public.subscriptions (status);
create index subscriptions_customer_id_idx on public.subscriptions (stripe_customer_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.entitlements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  feature      text not null,               -- ex.: 'premium'
  granted_until timestamptz,                 -- acesso valido enquanto now() < granted_until
  source       public.entitlement_source not null,
  source_ref   text,                         -- ex.: stripe_subscription_id
  updated_at   timestamptz not null default now(),
  constraint entitlements_user_feature_unique unique (user_id, feature)
);

comment on table public.entitlements is
  'Direitos de acesso derivados. A aplicacao le APENAS esta tabela para '
  'decidir Premium. Recalculada por syncSubscription. Escrita so service_role.';

create index entitlements_granted_until_idx on public.entitlements (granted_until);

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ---------- Grants (só leitura do próprio) ----------
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.entitlements  from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.entitlements  to authenticated;

-- ---------- RLS ----------
alter table public.subscriptions enable row level security;
alter table public.entitlements  enable row level security;

create policy "subscriptions_select_own_or_admin"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "entitlements_select_own_or_admin"
  on public.entitlements for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- ############ 20260720140400_stripe_ops.sql ############
-- ============================================================
-- STRIPE — operação: checkout_sessions, webhook_events, sync_log
-- ============================================================
-- checkout_sessions    : cliente lê a própria (tela de processamento).
-- webhook_events       : idempotência/auditoria. SÓ service_role (nem
--                        leitura para o cliente).
-- subscription_sync_log: auditoria de sync. SÓ service_role.
-- ============================================================

-- ---------- checkout_sessions ----------
create table public.checkout_sessions (
  id                        uuid primary key default gen_random_uuid(),
  stripe_checkout_session_id text not null unique,
  user_id                   uuid not null references auth.users (id) on delete cascade,
  stripe_price_id           text,
  status                    public.checkout_session_status not null default 'open',
  stripe_subscription_id    text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.checkout_sessions is
  'Rastreio das Checkout Sessions para reconciliacao no retorno. '
  'Cliente le a propria; escrita so service_role.';

create index checkout_sessions_user_id_idx on public.checkout_sessions (user_id);
create index checkout_sessions_status_idx  on public.checkout_sessions (status);

create trigger checkout_sessions_set_updated_at
  before update on public.checkout_sessions
  for each row execute function public.set_updated_at();

revoke all on public.checkout_sessions from anon, authenticated;
grant select on public.checkout_sessions to authenticated;

alter table public.checkout_sessions enable row level security;

create policy "checkout_sessions_select_own_or_admin"
  on public.checkout_sessions for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

-- ---------- webhook_events (idempotência + auditoria) ----------
create table public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,     -- dedup de eventos repetidos
  type            text not null,
  livemode        boolean not null,
  payload         jsonb,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  process_status  public.webhook_process_status not null default 'received',
  error           text
);

comment on table public.webhook_events is
  'Eventos recebidos da Stripe. UNIQUE(stripe_event_id) garante idempotencia. '
  'SEM acesso para anon/authenticated: so service_role.';

create index webhook_events_status_idx on public.webhook_events (process_status);
create index webhook_events_type_idx   on public.webhook_events (type);

-- Sem grant e sem policy: inacessível a anon/authenticated. Só service_role.
revoke all on public.webhook_events from anon, authenticated;
alter table public.webhook_events enable row level security;

-- ---------- subscription_sync_log (auditoria) ----------
create table public.subscription_sync_log (
  id                     uuid primary key default gen_random_uuid(),
  stripe_subscription_id text,
  source                 public.sync_source not null,
  event_id               text,
  status_before          text,
  status_after           text,
  entitlement_before     timestamptz,
  entitlement_after      timestamptz,
  created_at             timestamptz not null default now()
);

comment on table public.subscription_sync_log is
  'Trilha de auditoria de cada syncSubscription (antes/depois/origem). '
  'Append-only. SO service_role.';

create index subscription_sync_log_sub_idx
  on public.subscription_sync_log (stripe_subscription_id, created_at desc);

-- Sem grant e sem policy: só service_role.
revoke all on public.subscription_sync_log from anon, authenticated;
alter table public.subscription_sync_log enable row level security;

-- ############ 20260720140500_seed_premium_plan.sql ############
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
