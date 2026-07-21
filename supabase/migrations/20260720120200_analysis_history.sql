-- ============================================================
-- ANALYSIS HISTORY — preparada para a IA (ainda não integrada)
-- ============================================================
-- Estrutura pronta para receber as análises de print (conversa/story).
-- Nesta fase nenhuma linha é criada pelo produto: a tabela existe e
-- fica vazia. O Histórico exibe estado vazio real.
--
-- Regra: o resultado (result/status) é escrito pelo servidor. O cliente
-- pode criar o pedido e ler os próprios, nunca escrever o resultado.
-- ============================================================

create type public.analysis_type as enum (
  'analisar-conversa', 'analisar-story'
);

create type public.analysis_status as enum (
  'pending', 'processing', 'completed', 'failed'
);

create table public.analysis_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  tool       public.analysis_type not null,
  status     public.analysis_status not null default 'pending',
  input_ref  text,
  result     jsonb,
  created_at timestamptz not null default now()
);

comment on column public.analysis_history.input_ref is
  'Caminho no Storage do print enviado (preenchido na fase de IA).';
comment on column public.analysis_history.result is
  'Saída da IA. Escrito apenas pelo servidor (service_role).';

create index analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);
create index analysis_history_status_idx
  on public.analysis_history (status);

revoke all on public.analysis_history from anon, authenticated;
grant select, insert on public.analysis_history to authenticated;

alter table public.analysis_history enable row level security;

create policy "analysis_history_select_own_or_admin"
  on public.analysis_history for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "analysis_history_insert_own"
  on public.analysis_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- NOTA: esta permissão de INSERT é REVOGADA pela migration
-- 20260720130000_analysis_history_readonly.sql. Mantida aqui para
-- preservar o histórico linear das migrations.
