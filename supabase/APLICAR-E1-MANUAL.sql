-- APLICACAO MANUAL DE E1 -- SQL Editor do projeto desenrole-gringa-dev (mwpxxxwkvceeobaurgls)
-- Cole tudo e execute de uma vez.
-- Idempotente. Nao remove dados. Altera apenas policies e grants de analysis_history. So-leitura na verificacao.

drop policy if exists "analysis_history_insert_own" on public.analysis_history;
revoke insert, update, delete on public.analysis_history from authenticated;
revoke insert, update, delete on public.analysis_history from anon;
grant select on public.analysis_history to authenticated;
comment on table public.analysis_history is 'Historico de analises. Somente leitura para o cliente: a criacao e operacao de servidor (valida entitlement/cota e define status e result). O usuario nunca define status, result ou campos de consumo.';

-- Verificacao (somente leitura): authenticated nao pode mais escrever.
do $$
begin
  if has_table_privilege('authenticated', 'public.analysis_history', 'INSERT') then
    raise exception 'FALHA E1: authenticated ainda tem INSERT em analysis_history';
  end if;
  if has_table_privilege('authenticated', 'public.analysis_history', 'UPDATE') then
    raise exception 'FALHA E1: authenticated ainda tem UPDATE em analysis_history';
  end if;
  if has_table_privilege('authenticated', 'public.analysis_history', 'DELETE') then
    raise exception 'FALHA E1: authenticated ainda tem DELETE em analysis_history';
  end if;
  if not has_table_privilege('authenticated', 'public.analysis_history', 'SELECT') then
    raise exception 'FALHA E1: authenticated perdeu o SELECT (nao deveria)';
  end if;
  raise notice 'OK E1: authenticated tem apenas SELECT em analysis_history';
end $$;

-- Conferencia final: deve retornar exatamente uma linha, SELECT.
select privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'analysis_history'
  and grantee = 'authenticated'
order by privilege_type;
