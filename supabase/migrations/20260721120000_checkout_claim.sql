-- ============================================================
-- STRIPE S4c — claim atômico da Checkout Session + verificação de e-mail
-- ============================================================
-- Aditivo. Não altera fundação, RLS existente, nem outras tabelas Stripe.
--
-- claim_checkout_session(_session_id, _user_id)
--   Reivindicação ATÔMICA de uma Checkout Session por um usuário.
--   INSERT ... ON CONFLICT DO NOTHING — nunca sobrescreve o dono
--   anterior (o vínculo session_id -> user_id é imutável após o claim).
--   Duas chamadas concorrentes para o mesmo _session_id: o Postgres
--   serializa via o índice UNIQUE de stripe_checkout_session_id; só uma
--   INSERT vence, a outra é no-op e ambas leem o dono real depois.
--   Retorna claimed=true se ESTE _user_id é o dono (venceu agora ou já
--   era dele antes — retomada idempotente); claimed=false caso outro
--   usuário já seja o dono (owner_user_id indica quem).
--
-- email_has_account(_email)
--   true SOMENTE se existe conta com SENHA definida (encrypted_password
--   não vazio). Uma conta criada via OTP mas ainda sem senha (usuário no
--   meio do fluxo de /criar-conta) NÃO conta como "já tem conta" — isso
--   evita bloquear o próprio usuário que está finalizando o cadastro.
--   security definer é necessário para ler auth.users com segurança;
--   EXECUTE só para service_role.
-- ============================================================

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

revoke execute on function public.claim_checkout_session(text, uuid) from public, anon, authenticated;
revoke execute on function public.email_has_account(text) from public, anon, authenticated;
grant execute on function public.claim_checkout_session(text, uuid) to service_role;
grant execute on function public.email_has_account(text) to service_role;
