-- ============================================================
-- ENDURECIMENTO DAS FUNÇÕES (resposta ao database linter)
-- ============================================================
-- Achados do advisor de segurança do Supabase após as migrations
-- anteriores. Todos corrigidos aqui.
-- ============================================================

-- 1. search_path fixo também no trigger de updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. handle_new_user só deve rodar pelo trigger, nunca via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. has_role é chamada internamente por is_admin (SECURITY DEFINER, roda
--    com privilégios do owner), então não precisa ficar exposta na API.
--    Expor permitiria sondar o papel de QUALQUER usuário por id.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;

-- 4. is_admin PRECISA continuar executável por authenticated: o Postgres
--    exige EXECUTE na função usada dentro de uma policy de RLS, avaliada
--    no contexto de quem consulta. Revogar quebraria todas as policies.
--    Para anon não há policy que a use, então removemos.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
