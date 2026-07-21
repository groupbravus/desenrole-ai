-- ============================================================
-- SUÍTE DE TESTES DE RLS — Fase Banco & Identidade
-- ============================================================
-- Roda com privilégio de service_role (SQL Editor do Supabase ou
-- `psql` com a connection string do projeto). Cada bloco simula uma
-- persona trocando `role` + `request.jwt.claims`.
--
-- Personas cobertas:
--   1. anon                      (visitante)
--   2. authenticated (usuário A)
--   3. authenticated (usuário B) — isolamento entre contas
--   4. authenticated (admin)
--   5. service_role              — quem executa este script
--
-- Qualquer falha levanta exceção e aborta.
-- Ao final, remove os dados de teste.
-- ============================================================

begin;

-- ---------- Setup ----------
-- ATENÇÃO: as colunas de token precisam ser '' (string vazia), não NULL.
-- O GoTrue as lê como string não-nula; com NULL o login falha com
-- "Database error querying schema".
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls.a@teste.local',
   crypt('SenhaTeste123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Usuario A","locale":"pt-BR"}',
   '', '', '', '', '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls.b@teste.local',
   crypt('SenhaTeste123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Usuario B","locale":"en"}',
   '', '', '', '', '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls.admin@teste.local',
   crypt('SenhaTeste123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Admin Teste","locale":"pt-BR"}',
   '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

-- Trigger criou profile + papel 'user' para os três?
do $$
declare v_profiles int; v_roles int; v_admins int;
begin
  select count(*) into v_profiles from public.profiles
    where id in ('11111111-1111-1111-1111-111111111111',
                 '22222222-2222-2222-2222-222222222222',
                 '33333333-3333-3333-3333-333333333333');
  select count(*) into v_roles from public.user_roles
    where role = 'user' and user_id in ('11111111-1111-1111-1111-111111111111',
                                        '22222222-2222-2222-2222-222222222222',
                                        '33333333-3333-3333-3333-333333333333');
  select count(*) into v_admins from public.user_roles where role = 'admin';

  if v_profiles <> 3 then raise exception 'FALHA trigger: % profiles criados', v_profiles; end if;
  if v_roles    <> 3 then raise exception 'FALHA trigger: % papeis user', v_roles; end if;
  if v_admins   <> 0 then raise exception 'FALHA: cadastro concedeu admin!'; end if;
  raise notice 'OK trigger: profile + papel user criados; nenhum admin automatico';
end $$;

-- Promoção a admin (procedimento oficial: só service_role)
insert into public.user_roles (user_id, role)
values ('33333333-3333-3333-3333-333333333333', 'admin')
on conflict do nothing;

insert into public.quiz_results (user_id, client_result_id, profile, scores, version, completed_at)
values
  ('11111111-1111-1111-1111-111111111111','claim-a-001','observador','{"observador":4}','v1', now()),
  ('22222222-2222-2222-2222-222222222222','claim-b-001','direto','{"direto":5}','v1', now())
on conflict do nothing;

insert into public.support_requests (user_id, subject, message)
values
  ('11111111-1111-1111-1111-111111111111','technical','Chamado do usuario A para teste de RLS.'),
  ('22222222-2222-2222-2222-222222222222','billing','Chamado do usuario B para teste de RLS.');

-- ---------- 1. ANÔNIMO: bloqueado no GRANT ----------
do $$
declare v_blocked int := 0; v_table text;
begin
  foreach v_table in array array['profiles','user_roles','quiz_results','support_requests','analysis_history']
  loop
    begin
      set local role anon;
      set local request.jwt.claims = '{"role":"anon"}';
      execute format('select 1 from public.%I limit 1', v_table);
      reset role;
      raise exception 'FALHA anon: consultou %', v_table;
    exception when insufficient_privilege then
      reset role; v_blocked := v_blocked + 1;
    end;
  end loop;
  if v_blocked <> 5 then raise exception 'FALHA anon: % de 5 bloqueadas', v_blocked; end if;
  raise notice 'OK anon: bloqueado nas 5 tabelas';
end $$;

-- ---------- 2. USUÁRIO A: só os próprios dados ----------
do $$
declare v_profiles int; v_quiz int; v_support int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select count(*) into v_profiles from public.profiles;
  select count(*) into v_quiz     from public.quiz_results;
  select count(*) into v_support  from public.support_requests;
  reset role;

  if v_profiles <> 1 then raise exception 'FALHA A: % profiles', v_profiles; end if;
  if v_quiz     <> 1 then raise exception 'FALHA A: % quiz', v_quiz; end if;
  if v_support  <> 1 then raise exception 'FALHA A: % chamados', v_support; end if;
  raise notice 'OK usuario A: isolado';
end $$;

-- ---------- 3. USUÁRIO B: não vê dados de A ----------
do $$
declare v_leak int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  select count(*) into v_leak from public.quiz_results
    where user_id = '11111111-1111-1111-1111-111111111111';
  reset role;
  if v_leak <> 0 then raise exception 'FALHA B: leu dado de A'; end if;
  raise notice 'OK usuario B: isolado de A';
end $$;

-- ---------- CRÍTICO: sem auto-promoção a admin ----------
do $$
declare v_blocked int := 0;
begin
  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    insert into public.user_roles values ('11111111-1111-1111-1111-111111111111', 'admin');
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1;
  end;

  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    update public.user_roles set role = 'admin' where user_id = '11111111-1111-1111-1111-111111111111';
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1;
  end;

  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    delete from public.user_roles where user_id = '11111111-1111-1111-1111-111111111111';
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := v_blocked + 1;
  end;

  if v_blocked <> 3 then raise exception 'FALHA CRITICA: % de 3 escritas bloqueadas', v_blocked; end if;
  if public.has_role('11111111-1111-1111-1111-111111111111','admin') then
    raise exception 'FALHA CRITICA: usuario comum virou admin';
  end if;
  raise notice 'OK: INSERT/UPDATE/DELETE em user_roles negados';
end $$;

-- ---------- 4. ADMIN: acesso amplo ----------
do $$
declare v_profiles int; v_users int; v_stats int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  select count(*) into v_profiles from public.profiles;
  select count(*) into v_users    from public.admin_list_users();
  select count(*) into v_stats    from public.admin_stats();
  reset role;

  if v_profiles < 3 then raise exception 'FALHA admin: % profiles', v_profiles; end if;
  if v_users    < 3 then raise exception 'FALHA admin: admin_list_users devolveu %', v_users; end if;
  if v_stats   <> 1 then raise exception 'FALHA admin: admin_stats devolveu %', v_stats; end if;
  raise notice 'OK admin: leitura ampla e funcoes administrativas';
end $$;

-- Não-admin chamando funções administrativas → vazio
do $$
declare v_users int; v_stats int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select count(*) into v_users from public.admin_list_users();
  select count(*) into v_stats from public.admin_stats();
  reset role;
  if v_users <> 0 or v_stats <> 0 then raise exception 'FALHA: nao-admin obteve dado administrativo'; end if;
  raise notice 'OK: funcoes administrativas vazias para nao-admin';
end $$;

-- has_role não é sondável por usuário comum
do $$
declare v_blocked boolean := false;
begin
  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    perform public.has_role('33333333-3333-3333-3333-333333333333','admin');
    reset role;
  exception when insufficient_privilege then reset role; v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALHA: has_role sondavel'; end if;
  raise notice 'OK: has_role nao exposta a usuario comum';
end $$;

-- ---------- IDEMPOTÊNCIA do quiz ----------
do $$
declare v_count int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  insert into public.quiz_results (user_id, client_result_id, profile, scores, version, completed_at)
  values ('11111111-1111-1111-1111-111111111111','claim-a-001','direto','{"direto":9}','v1', now())
  on conflict (user_id, client_result_id) do nothing;
  insert into public.quiz_results (user_id, client_result_id, profile, scores, version, completed_at)
  values ('11111111-1111-1111-1111-111111111111','claim-a-001','ansioso','{"ansioso":9}','v1', now())
  on conflict (user_id, client_result_id) do nothing;
  reset role;

  select count(*) into v_count from public.quiz_results
    where user_id = '11111111-1111-1111-1111-111111111111';
  if v_count <> 1 then raise exception 'FALHA idempotencia: % linhas', v_count; end if;
  raise notice 'OK idempotencia: mesma chave nao duplica';
end $$;

-- ---------- ESCRITA CRUZADA bloqueada ----------
do $$
declare v_blocked int := 0; v_name text;
begin
  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    insert into public.quiz_results (user_id, client_result_id, profile, scores, version, completed_at)
    values ('22222222-2222-2222-2222-222222222222','forjado','direto','{}','v1', now());
    reset role;
  exception when others then reset role; v_blocked := v_blocked + 1;
  end;

  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    insert into public.support_requests (user_id, subject, message)
    values ('22222222-2222-2222-2222-222222222222','other','Chamado forjado.');
    reset role;
  exception when others then reset role; v_blocked := v_blocked + 1;
  end;

  -- UPDATE cruzado não falha: o USING da policy simplesmente não casa
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  update public.profiles set name = 'Invadido'
    where id = '22222222-2222-2222-2222-222222222222';
  reset role;

  select name into v_name from public.profiles
    where id = '22222222-2222-2222-2222-222222222222';

  if v_blocked <> 2 then raise exception 'FALHA: % de 2 inserts cruzados bloqueados', v_blocked; end if;
  if v_name <> 'Usuario B' then raise exception 'FALHA: perfil de B foi alterado por A'; end if;
  raise notice 'OK: escrita cruzada bloqueada (inserts negados, update afetou 0 linhas)';
end $$;

-- ---------- E1: analysis_history é somente leitura ----------
-- Tentativa de falsificação: o usuário forja uma análise "concluída".
do $$
declare v_blocked boolean := false; v_count int;
begin
  begin
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
    insert into public.analysis_history (user_id, tool, status, result)
    values ('11111111-1111-1111-1111-111111111111', 'analisar-conversa',
            'completed', '{"suggestions":["resultado forjado pelo cliente"]}');
    reset role;
  exception when insufficient_privilege then
    reset role; v_blocked := true;
  end;

  if not v_blocked then
    raise exception 'FALHA E1: cliente inseriu analise com status/result forjados';
  end if;

  select count(*) into v_count from public.analysis_history;
  if v_count <> 0 then
    raise exception 'FALHA E1: % linha(s) criada(s) pelo cliente', v_count;
  end if;
  raise notice 'OK E1: INSERT em analysis_history negado ao cliente';
end $$;

-- Leitura dos próprios registros continua permitida
do $$
declare v_ok int;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select count(*) into v_ok from public.analysis_history;
  reset role;
  raise notice 'OK E1: SELECT proprio segue funcionando (% linhas)', v_ok;
end $$;

-- ---------- Teardown ----------
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

do $$ begin raise notice '=== TODOS OS TESTES DE RLS PASSARAM ==='; end $$;

commit;
