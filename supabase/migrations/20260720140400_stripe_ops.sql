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
