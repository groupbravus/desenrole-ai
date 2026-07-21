-- ============================================================
-- LEITURA ADMINISTRATIVA — sem service_role na aplicação
-- ============================================================
-- As policies já dão SELECT amplo ao admin nas tabelas públicas.
-- O único dado fora do alcance era o e-mail, que vive em auth.users.
--
-- Em vez de colocar a SERVICE ROLE KEY dentro da aplicação (chave que
-- ignora RLS por completo), expomos funções SECURITY DEFINER com a
-- autorização DENTRO da própria função: `where public.is_admin()`.
-- Um não-admin recebe zero linhas — nunca um erro que confirme a
-- existência dos dados.
-- ============================================================

create function public.admin_list_users()
returns table (
  id         uuid,
  name       text,
  email      text,
  created_at timestamptz,
  roles      text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    u.email::text,
    p.created_at,
    coalesce(
      array_agg(ur.role::text order by ur.role) filter (where ur.role is not null),
      array[]::text[]
    ) as roles
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  where public.is_admin()
  group by p.id, p.name, u.email, p.created_at
  order by p.created_at desc
  limit 200;
$$;

create function public.admin_get_user(_user_id uuid)
returns table (
  id         uuid,
  name       text,
  email      text,
  created_at timestamptz,
  roles      text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    u.email::text,
    p.created_at,
    coalesce(
      array_agg(ur.role::text order by ur.role) filter (where ur.role is not null),
      array[]::text[]
    ) as roles
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  where public.is_admin() and p.id = _user_id
  group by p.id, p.name, u.email, p.created_at;
$$;

create function public.admin_stats()
returns table (
  total_users      bigint,
  new_users_30d    bigint,
  quiz_completions bigint,
  open_support     bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    (select count(*) from public.quiz_results),
    (select count(*) from public.support_requests where status = 'open')
  where public.is_admin();
$$;

revoke execute on function public.admin_list_users()   from public, anon;
revoke execute on function public.admin_get_user(uuid) from public, anon;
revoke execute on function public.admin_stats()        from public, anon;

grant execute on function public.admin_list_users()   to authenticated;
grant execute on function public.admin_get_user(uuid) to authenticated;
grant execute on function public.admin_stats()        to authenticated;
