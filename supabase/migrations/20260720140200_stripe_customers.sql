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
