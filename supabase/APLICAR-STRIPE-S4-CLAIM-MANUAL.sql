-- ============================================================
-- APLICAR — STRIPE S4c — claim atômico + verificação de e-mail
-- ============================================================
-- Rodar UMA vez no SQL Editor do projeto de DEVELOPMENT.
-- Pré-requisito: S1 já aplicada (tabela public.checkout_sessions e o
-- unique(stripe_checkout_session_id) já existem — confirmado no banco:
-- constraint checkout_sessions_stripe_checkout_session_id_key).
--
-- Idempotente: create or replace function + revoke/grant declarativos.
-- NÃO altera fundação, RLS existente, nem outras tabelas Stripe.
-- Uma única transação.
-- ============================================================

begin;

-- 1) Claim atômico: INSERT ... ON CONFLICT DO NOTHING. Nunca sobrescreve
--    o dono anterior — o vínculo session_id -> user_id é imutável.
create or replace function public.claim_checkout_session(
  _session_id text,
  _user_id    uuid
)
returns table (claimed boolean, owner_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  insert into public.checkout_sessions (stripe_checkout_session_id, user_id)
  values (_session_id, _user_id)
  on conflict (stripe_checkout_session_id) do nothing;

  select cs.user_id into v_owner
  from public.checkout_sessions cs
  where cs.stripe_checkout_session_id = _session_id;

  return query select (v_owner = _user_id), v_owner;
end;
$$;

-- 2) true só para contas com SENHA definida (uma conta OTP sem senha
--    ainda, no meio do próprio fluxo de criação, não conta).
create or replace function public.email_has_account(_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(_email)
      and u.encrypted_password is not null
      and u.encrypted_password <> ''
  );
$$;

-- 3) Só o backend (service_role) executa; jamais o cliente.
revoke execute on function public.claim_checkout_session(text, uuid) from public, anon, authenticated;
revoke execute on function public.email_has_account(text) from public, anon, authenticated;
grant  execute on function public.claim_checkout_session(text, uuid) to service_role;
grant  execute on function public.email_has_account(text) to service_role;

commit;

-- ============================================================
-- Verificação (rodar após o commit; deve retornar linhas):
-- ============================================================
-- select proname from pg_proc
--   where proname in ('claim_checkout_session','email_has_account');
--
-- select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_exec
--   from pg_proc p
--   cross join (values ('anon'),('authenticated'),('service_role')) as r(rolname)
--   where p.proname in ('claim_checkout_session','email_has_account')
--   order by p.proname, r.rolname;
-- Esperado: service_role=true; anon/authenticated=false.
--
-- Teste funcional (opcional, substitua os valores por um id de teste):
--   select * from public.claim_checkout_session('cs_test_x', '00000000-0000-0000-0000-000000000000');
--   -- 1a chamada: claimed=true. Rodar de novo com o MESMO user_id: continua
--   -- claimed=true (retomada). Rodar com OUTRO user_id: claimed=false.
--   -- Depois: delete from public.checkout_sessions where stripe_checkout_session_id = 'cs_test_x';

-- ============================================================
-- ROLLBACK (se necessário; não remove a tabela nem os dados):
-- ============================================================
-- drop function if exists public.claim_checkout_session(text, uuid);
-- drop function if exists public.email_has_account(text);
