-- ============================================================
-- ROLLBACK — Fase Stripe S1
-- ============================================================
-- Desfaz TUDO que a S1 criou (8 tabelas + 6 enums Stripe). Não toca
-- em nada da fundação (profiles, user_roles, etc.).
--
-- Ordem: tabelas primeiro (dependências via FK e enums), depois tipos.
-- `if exists` + `cascade` tornam seguro rodar mesmo em estado parcial.
-- ============================================================

-- Tabelas (cascade remove policies, índices, triggers e grants junto).
drop table if exists public.subscription_sync_log cascade;
drop table if exists public.webhook_events        cascade;
drop table if exists public.checkout_sessions     cascade;
drop table if exists public.entitlements          cascade;
drop table if exists public.subscriptions         cascade;
drop table if exists public.plan_prices           cascade;
drop table if exists public.plans                 cascade;
drop table if exists public.stripe_customers      cascade;

-- Enums (só depois das tabelas que os usam).
drop type if exists public.sync_source            cascade;
drop type if exists public.webhook_process_status cascade;
drop type if exists public.checkout_session_status cascade;
drop type if exists public.entitlement_source     cascade;
drop type if exists public.subscription_status    cascade;
drop type if exists public.billing_interval       cascade;

-- Verificação: nada da S1 deve restar.
do $$
declare v_tables int; v_types int;
begin
  select count(*) into v_tables from information_schema.tables
   where table_schema = 'public'
     and table_name in ('stripe_customers','plans','plan_prices','subscriptions',
                        'entitlements','checkout_sessions','webhook_events',
                        'subscription_sync_log');
  select count(*) into v_types from pg_type
   where typname in ('billing_interval','subscription_status','entitlement_source',
                     'checkout_session_status','webhook_process_status','sync_source');
  if v_tables <> 0 or v_types <> 0 then
    raise exception 'ROLLBACK incompleto: % tabelas, % tipos restantes', v_tables, v_types;
  end if;
  raise notice 'OK rollback: nenhuma tabela/tipo da S1 restante';
end $$;
