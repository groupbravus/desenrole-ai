-- ============================================================
-- QUIZ RESULTS — apenas o resultado final (sem progresso parcial)
-- ============================================================
-- O quiz é respondido ANTES do cadastro. O progresso fica só no
-- localStorage. Ao autenticar, o resultado é "reivindicado" e gravado
-- aqui. A reivindicação precisa ser IDEMPOTENTE: recarregar a página
-- não pode duplicar. Por isso client_result_id + UNIQUE(user_id, ...).
--
-- O quiz NÃO tem autoridade para liberar acesso Premium.
-- ============================================================

create type public.quiz_profile as enum (
  'observador', 'direto', 'ansioso', 'quase-la'
);

create table public.quiz_results (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  client_result_id text not null,
  profile          public.quiz_profile not null,
  scores           jsonb not null default '{}'::jsonb,
  version          text not null,
  completed_at     timestamptz not null,
  created_at       timestamptz not null default now(),
  constraint quiz_results_client_id_unique unique (user_id, client_result_id)
);

comment on column public.quiz_results.client_result_id is
  'Chave de idempotência gerada no cliente ao concluir o quiz.';
comment on column public.quiz_results.completed_at is
  'Quando o usuário concluiu o quiz (pode ser anterior ao cadastro).';

create index quiz_results_user_completed_idx
  on public.quiz_results (user_id, completed_at desc);

revoke all on public.quiz_results from anon, authenticated;
grant select, insert on public.quiz_results to authenticated;

alter table public.quiz_results enable row level security;

create policy "quiz_results_select_own_or_admin"
  on public.quiz_results for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "quiz_results_insert_own"
  on public.quiz_results for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Sem UPDATE/DELETE: resultado de quiz é histórico imutável.
