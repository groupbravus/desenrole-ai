-- ============================================================
-- TESTES — Fase Stripe S1 (estrutura + RLS)
-- ============================================================
-- Rodar no SQL Editor DEPOIS de aplicar APLICAR-STRIPE-S1-MANUAL.sql.
-- Roda com privilégio de service_role e simula personas trocando
-- `role` + `request.jwt.claims`. Qualquer falha levanta exceção.
-- Não cria usuários; usa um sub fictício (as checagens são de
-- grant/policy, não de linhas reais). Não deixa resíduo.
-- ============================================================

begin;

-- ---------- 1. Estrutura: 8 tabelas + 6 enums existem ----------
do $$
declare v_t int; v_e int;
begin
  select count(*) into v_t from information_schema.tables
   where table_schema='public' and table_name in
    ('stripe_customers','plans','plan_prices','subscriptions','entitlements',
     'checkout_sessions','webhook_events','subscription_sync_log');
  select count(*) into v_e from pg_type where typname in
    ('billing_interval','subscription_status','entitlement_source',
     'checkout_session_status','webhook_process_status','sync_source');
  if v_t <> 8 then raise exception 'FALHA: % de 8 tabelas', v_t; end if;
  if v_e <> 6 then raise exception 'FALHA: % de 6 enums', v_e; end if;
  raise notice 'OK estrutura: 8 tabelas + 6 enums';
end $$;

-- ---------- 2. RLS habilitado nas 8 tabelas ----------
do $$
declare v int;
begin
  select count(*) into v from pg_tables
   where schemaname='public' and rowsecurity=true and tablename in
    ('stripe_customers','plans','plan_prices','subscriptions','entitlements',
     'checkout_sessions','webhook_events','subscription_sync_log');
  if v <> 8 then raise exception 'FALHA: RLS ativo em % de 8', v; end if;
  raise notice 'OK: RLS ativo nas 8 tabelas';
end $$;

-- ---------- 3. Seed do plano Premium ----------
do $$
declare v_plan int; v_amount int; v_curr text; v_int text;
begin
  select count(*) into v_plan from public.plans where id='premium' and active;
  if v_plan <> 1 then raise exception 'FALHA: plano premium ausente'; end if;
  select unit_amount, currency, interval::text into v_amount, v_curr, v_int
    from public.plan_prices where plan_id='premium';
  if v_amount <> 990 or v_curr <> 'usd' or v_int <> 'month' then
    raise exception 'FALHA: preco esperado 990/usd/month, veio %/%/%', v_amount, v_curr, v_int;
  end if;
  raise notice 'OK seed: premium US$ 9,90/mes USD';
end $$;

-- ---------- 4. Catálogo é público (anon lê plans/plan_prices) ----------
do $$
declare v1 int; v2 int;
begin
  set local role anon;
  set local request.jwt.claims = '{"role":"anon"}';
  select count(*) into v1 from public.plans;
  select count(*) into v2 from public.plan_prices;
  reset role;
  if v1 < 1 or v2 < 1 then raise exception 'FALHA: anon nao leu catalogo'; end if;
  raise notice 'OK: catalogo publico legivel por anon';
end $$;

-- ---------- 5. Tabelas financeiras: anon NÃO lê ----------
do $$
declare v_blocked int := 0; t text;
begin
  foreach t in array array['stripe_customers','subscriptions','entitlements',
                           'checkout_sessions','webhook_events','subscription_sync_log']
  loop
    begin
      set local role anon;
      set local request.jwt.claims = '{"role":"anon"}';
      execute format('select 1 from public.%I limit 1', t);
      reset role;
      raise exception 'FALHA: anon leu %', t;
    exception when insufficient_privilege then
      reset role; v_blocked := v_blocked + 1;
    end;
  end loop;
  if v_blocked <> 6 then raise exception 'FALHA: anon bloqueado em % de 6', v_blocked; end if;
  raise notice 'OK: anon bloqueado nas 6 tabelas financeiras';
end $$;

-- ---------- 6. authenticated NÃO escreve em tabela financeira ----------
-- Grant de escrita não existe → insufficient_privilege em qualquer INSERT.
do $$
declare v_blocked int := 0;
  claims text := '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
begin
  -- subscriptions
  begin set local role authenticated; set local request.jwt.claims = claims;
    insert into public.subscriptions (stripe_subscription_id, user_id, stripe_customer_id, status)
    values ('sub_forjado','00000000-0000-0000-0000-000000000000','cus_x','active');
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1; end;

  -- entitlements (auto-concessão de Premium!)
  begin set local role authenticated; set local request.jwt.claims = claims;
    insert into public.entitlements (user_id, feature, granted_until, source)
    values ('00000000-0000-0000-0000-000000000000','premium', now() + interval '999 days','manual');
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1; end;

  -- stripe_customers
  begin set local role authenticated; set local request.jwt.claims = claims;
    insert into public.stripe_customers (user_id, stripe_customer_id)
    values ('00000000-0000-0000-0000-000000000000','cus_forjado');
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1; end;

  -- webhook_events
  begin set local role authenticated; set local request.jwt.claims = claims;
    insert into public.webhook_events (stripe_event_id, type, livemode)
    values ('evt_forjado','x',false);
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1; end;

  if v_blocked <> 4 then
    raise exception 'FALHA CRITICA: % de 4 escritas financeiras bloqueadas', v_blocked;
  end if;
  raise notice 'OK: authenticated NAO escreve em tabela financeira (sem auto-Premium)';
end $$;

-- ---------- 7. authenticated não lê webhook_events / sync_log ----------
do $$
declare v_blocked int := 0; t text;
begin
  foreach t in array array['webhook_events','subscription_sync_log']
  loop
    begin
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
      execute format('select 1 from public.%I limit 1', t);
      reset role;
      raise exception 'FALHA: authenticated leu %', t;
    exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1; end;
  end loop;
  if v_blocked <> 2 then raise exception 'FALHA: % de 2 bloqueadas', v_blocked; end if;
  raise notice 'OK: webhook_events e sync_log invisiveis ao cliente';
end $$;

-- ---------- 8. Foreign keys presentes ----------
do $$
declare v int;
begin
  select count(*) into v from information_schema.table_constraints
   where table_schema='public' and constraint_type='FOREIGN KEY'
     and table_name in ('stripe_customers','plan_prices','subscriptions',
                        'entitlements','checkout_sessions');
  if v < 5 then raise exception 'FALHA: esperado >=5 FKs, veio %', v; end if;
  raise notice 'OK: foreign keys presentes (%)', v;
end $$;

do $$ begin raise notice '=== TODOS OS TESTES S1 PASSARAM ==='; end $$;

rollback;  -- não persiste nada; os testes são só de verificação
