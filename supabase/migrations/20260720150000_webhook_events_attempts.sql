-- ============================================================
-- STRIPE S3 — webhook_events: coluna `attempts` + funções atômicas
-- ============================================================
-- Aditivo. Não altera a fundação nem as outras tabelas Stripe.
--
-- `attempts` conta quantas vezes a Stripe reenviou o mesmo evento
-- (retries). As duas funções abaixo são a via ATÔMICA de dedup e
-- marcação, chamadas apenas pelo backend (service_role):
--
--   record_webhook_event() → insere o evento ou, se já existe,
--     incrementa attempts. Retorna se já foi processado (idempotência).
--   mark_webhook_event()   → marca o resultado (processed/error).
-- ============================================================

alter table public.webhook_events
  add column if not exists attempts integer not null default 0;

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
  v_status  public.webhook_process_status;
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

-- Só o backend (service_role) executa; nunca o cliente.
revoke execute on function public.record_webhook_event(text, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.mark_webhook_event(text, public.webhook_process_status, text) from public, anon, authenticated;
grant execute on function public.record_webhook_event(text, text, boolean, jsonb) to service_role;
grant execute on function public.mark_webhook_event(text, public.webhook_process_status, text) to service_role;
