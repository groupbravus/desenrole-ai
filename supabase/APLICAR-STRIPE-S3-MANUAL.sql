-- ============================================================
-- APLICAR — STRIPE S3 — webhook_events.attempts + funções atômicas
-- ============================================================
-- Rodar UMA vez no SQL Editor do projeto de DEVELOPMENT.
-- Pré-requisito: S1 já aplicada (tabela public.webhook_events e enum
-- public.webhook_process_status já existem).
--
-- Idempotente: pode rodar de novo sem erro nem perda de dados
--   - add column if not exists
--   - create or replace function
--   - revoke/grant são declarativos
--
-- NÃO altera fundação, nem as outras tabelas Stripe, nem RLS/policies.
-- É uma única transação.
-- ============================================================

begin;

-- 1) Contador de reentregas do mesmo evento (retries da Stripe).
alter table public.webhook_events
  add column if not exists attempts integer not null default 0;

-- 2) Dedup atômico + idempotência.
--    Insere o evento; se já existe (stripe_event_id único), incrementa
--    attempts. Retorna se já havia sido PROCESSADO, para o webhook
--    decidir se reprocessa ou apenas confirma.
create or replace function public.record_webhook_event(
  _event_id text,
  _type     text,
  _livemode boolean,
  _payload  jsonb
)
returns table (already_processed boolean, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   public.webhook_process_status;
  v_attempts integer;
begin
  insert into public.webhook_events (stripe_event_id, type, livemode, payload)
  values (_event_id, _type, _livemode, _payload)
  on conflict (stripe_event_id) do update
    set attempts = public.webhook_events.attempts + 1
  returning process_status, public.webhook_events.attempts
    into v_status, v_attempts;

  return query select (v_status = 'processed'), v_attempts;
end;
$$;

-- 3) Marca o resultado do processamento (processed / skipped / error).
create or replace function public.mark_webhook_event(
  _event_id text,
  _status   public.webhook_process_status,
  _error    text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.webhook_events
     set process_status = _status,
         processed_at   = now(),
         error          = _error
   where stripe_event_id = _event_id;
$$;

-- 4) Só o backend (service_role) executa; jamais o cliente.
revoke execute on function public.record_webhook_event(text, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_webhook_event(text, public.webhook_process_status, text) from public, anon, authenticated;
grant  execute on function public.record_webhook_event(text, text, boolean, jsonb) to service_role;
grant  execute on function public.mark_webhook_event(text, public.webhook_process_status, text) to service_role;

commit;

-- ============================================================
-- Verificação rápida (rodar após o commit; deve retornar linhas):
-- ============================================================
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='webhook_events'
--     and column_name='attempts';
--
-- select proname from pg_proc
--   where proname in ('record_webhook_event','mark_webhook_event');
--
-- select proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_exec
--   from pg_proc p
--   cross join (values ('anon'),('authenticated'),('service_role')) as r(rolname)
--   where p.proname in ('record_webhook_event','mark_webhook_event')
--   order by proname, r.rolname;
-- Esperado: service_role=true; anon/authenticated=false.
