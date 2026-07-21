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
