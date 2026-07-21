-- ============================================================
-- E1 — analysis_history vira SOMENTE LEITURA para o cliente
-- ============================================================
-- Antes: `grant insert` + policy permitiam o usuário criar linhas com
-- `status` e `result` arbitrários. Hoje é inócuo (não há IA nem cota),
-- mas vira vetor no instante em que existir quota: o usuário poderia
-- forjar histórico ("análise concluída") ou distorcer a contagem.
--
-- Agora: o cliente só LÊ os próprios registros. A criação passará a ser
-- exclusividade de uma operação segura do servidor (SECURITY DEFINER ou
-- service_role) que valide entitlement, decremente cota e defina
-- `status`/`result` — nunca o usuário.
--
-- Dupla barreira, como em user_roles: sem policy E sem grant.
-- ============================================================

drop policy if exists "analysis_history_insert_own" on public.analysis_history;

revoke insert, update, delete on public.analysis_history from authenticated, anon;

-- Mantém apenas a leitura dos próprios registros (policy de SELECT
-- permanece inalterada: dono ou admin).
grant select on public.analysis_history to authenticated;

comment on table public.analysis_history is
  'Histórico de análises. SOMENTE LEITURA para o cliente: a criação é '
  'operação de servidor (valida entitlement/cota e define status e result). '
  'O usuário nunca define status, result ou campos de consumo.';
