-- ============================================================
-- IDENTIDADE — profiles + user_roles + helpers + RLS
-- ============================================================
-- profiles guarda APENAS identidade. Nada financeiro, nada de
-- papel administrativo, nada de quota. Papéis vivem em user_roles.
--
-- NOTA DE ORDENAÇÃO: profiles e user_roles vão na MESMA migration
-- de propósito. As policies de profiles dependem de is_admin(), que
-- lê user_roles; e o trigger de signup escreve nas duas tabelas.
-- Separar em dois arquivos criaria um estado intermediário inválido.
-- ============================================================

-- ---------- Enums ----------
create type public.app_role as enum ('user', 'admin');

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text,
  avatar_url text,
  locale     text not null default 'pt-BR'
             check (locale in ('pt-BR', 'en', 'es', 'fr', 'it', 'de')),
  timezone   text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Identidade do usuário. PROIBIDO: plano, assinatura, premium, stripe, quotas, papel.';

-- ---------- user_roles ----------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role    public.app_role not null,
  primary key (user_id, role)
);

comment on table public.user_roles is
  'RBAC. Nunca gravável por usuário autenticado — apenas service_role/migration.';

create index user_roles_role_idx on public.user_roles (role);

-- ---------- updated_at automático ----------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- RBAC helpers ----------
-- SECURITY DEFINER é obrigatório: as policies de user_roles referenciam
-- is_admin(), que lê user_roles. Sem definer isso vira recursão infinita
-- de RLS. A função definer lê a tabela ignorando RLS e quebra o ciclo.
create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ---------- Trigger de signup ----------
-- Cria o profile e concede SEMPRE e SOMENTE o papel 'user'.
-- Nenhum caminho de cadastro concede 'admin'.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
begin
  v_locale := coalesce(new.raw_user_meta_data ->> 'locale', 'pt-BR');
  if v_locale not in ('pt-BR', 'en', 'es', 'fr', 'it', 'de') then
    v_locale := 'pt-BR';
  end if;

  insert into public.profiles (id, name, locale)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    v_locale
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Privilégios (least privilege) ----------
-- anon não recebe nada. authenticated recebe o mínimo; RLS restringe linhas.
revoke all on public.profiles   from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

grant select, update on public.profiles   to authenticated;
grant select          on public.user_roles to authenticated;
-- Sem INSERT/UPDATE/DELETE em user_roles para authenticated:
-- impede auto-promoção a admin mesmo se uma policy for adicionada por engano.

-- ---------- RLS ----------
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;

-- profiles: dono lê/edita o próprio; admin lê e edita todos.
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles_update_admin"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sem policy de INSERT: profiles só nasce pelo trigger (security definer).
-- Sem policy de DELETE: remoção acompanha o delete de auth.users (cascade).

-- user_roles: leitura do próprio papel; admin lê todos.
-- NENHUMA policy de escrita — concessão de papel é operação de servidor.
create policy "user_roles_select_own_or_admin"
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());
