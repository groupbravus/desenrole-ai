-- ============================================================
-- SUPPORT REQUESTS — chamados do formulário de contato
-- ============================================================
-- Usuário cria e lê os próprios chamados. Admin lê todos e atualiza
-- o status. user_id é nullable com ON DELETE SET NULL para preservar
-- o histórico de atendimento mesmo se a conta for removida.
-- ============================================================

create type public.support_subject as enum (
  'billing', 'technical', 'account', 'other'
);

create type public.support_status as enum (
  'open', 'in_progress', 'resolved'
);

create table public.support_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  subject    public.support_subject not null,
  message    text not null check (char_length(message) between 10 and 5000),
  status     public.support_status not null default 'open',
  created_at timestamptz not null default now()
);

create index support_requests_user_created_idx
  on public.support_requests (user_id, created_at desc);
create index support_requests_status_idx
  on public.support_requests (status);

revoke all on public.support_requests from anon, authenticated;
grant select, insert, update on public.support_requests to authenticated;

alter table public.support_requests enable row level security;

create policy "support_requests_select_own_or_admin"
  on public.support_requests for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "support_requests_insert_own"
  on public.support_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Apenas admin muda status (triagem/atendimento).
create policy "support_requests_update_admin"
  on public.support_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
