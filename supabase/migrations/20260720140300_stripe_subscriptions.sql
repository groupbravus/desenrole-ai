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
