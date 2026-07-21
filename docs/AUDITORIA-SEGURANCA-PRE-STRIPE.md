# AUDITORIA DE SEGURANÇA — pré-Stripe

Revisão adversarial de RLS, middleware, SSR, auth, Server Actions,
cookies, sessões e escalada de privilégios. Feita **sondando o sistema em
execução**, não apenas lendo código.

Alvo: projeto `desenrole-gringa-dev` + app local.

---

## Veredito

Nenhuma falha crítica. A superfície anônima — que é o que a internet
alcança — está **completamente fechada**. Encontrei **1 falha de
severidade alta** (corrigida durante a auditoria), 1 item de higiene
(corrigido) e 4 itens que dependiam de decisão do proprietário ou de
endurecimento antes da fase de IA.

> **Rodada 2 (pós-decisões D1/D2/E1).** Todos os itens foram endereçados
> em código. Ver a seção "Rodada 2" ao final. Restam apenas verificações
> de runtime que dependem de contas reais e do MCP do Supabase.

---

## Corrigido durante a auditoria

### 🔴 A1 — Open redirect no `?next=` do login (ALTA)

**O que era.** O formulário de login lia `?next=` da URL e entregava o
valor direto ao `router.replace()`, com o único tratamento sendo remover
o prefixo de idioma. A função `safeNext`, que validaria, existia no
código mas **nunca era usada nesse caminho**.

Comprovado experimentalmente — entrada → valor repassado à navegação:

```
//evil.com           -> "//evil.com"
https://evil.com     -> "https://evil.com"
javascript:alert(1)  -> "javascript:alert(1)"
/pt-BR/../../evil    -> "/../../evil"
```

**Impacto.** Phishing com credencial real: o atacante envia
`https://app/pt-BR/login?next=https://evil.com`, a vítima faz um login
**legítimo no domínio verdadeiro** e é jogada num clone. O link parece
confiável porque o domínio é o certo.

**Correção.** Novo `safeInternalPath()` em `src/lib/locale-path.ts`,
aplicado no login. Rejeita: barra dupla, esquema absoluto, `javascript:`,
barra invertida (normalizada para `/` por vários navegadores) e `..`.
Destino inválido cai no padrão `/painel`. As mesmas regras foram
aplicadas ao callback de e-mail.

Verificado após a correção: todos os vetores acima retornam `null`;
`/pt-BR/painel` e `/pt-BR/admin` seguem funcionando.

### 🟡 A2 — Server Action morta exposta como endpoint (BAIXA)

`resolvePostLoginPath` nunca era chamada, mas vivia num arquivo
`"use server"` — e **todo export num arquivo desses vira um endpoint POST
público**. Removida.

> Regra permanente: em arquivo `"use server"`, exportar é publicar. Nada
> de helpers exportados.

---

## Requer decisão sua

### 🟠 D1 — Troca de senha não exige a senha atual (MÉDIA)

`updatePasswordAction` troca a senha apenas com a sessão válida. Quem
obtiver uma sessão (notebook destravado, cookie roubado) troca a senha e
**expulsa o dono permanentemente** — o que transforma um acesso temporário
em tomada de conta definitiva.

**Recomendo:** ligar `secure_password_change` no Supabase
(Authentication → Providers → Email), que exige reautenticação recente.
Custo: um passo a mais para o usuário. Benefício: elimina a escalada de
"sessão roubada" para "conta perdida".

### 🟠 D2 — Cookie de sessão legível por JavaScript (MÉDIA)

O `@supabase/ssr` não marca os cookies como `httpOnly` porque o client de
browser precisa lê-los. Consequência: um XSS rouba a sessão.

**Descoberta relevante:** auditei o código e **o client de browser nunca é
usado** — todo acesso ao Supabase é server-side (Server Components e
Server Actions). Ou seja, dá para forçar `httpOnly: true` nos nossos
`setAll()` e fechar essa porta por completo.

**Tradeoff:** isso impede uso futuro do client de browser (realtime,
estado de auth reativo no cliente). Se a arquitetura vai continuar
server-side — e hoje ela é —, o ganho é direto.

Decisão sua. Se aprovar, aplico junto da remoção do
`src/lib/supabase/client.ts` (hoje código morto).

### 🟡 D3 — Enumeração de e-mail no cadastro (BAIXA)

O cadastro devolve `emailTaken`, permitindo descobrir quais e-mails têm
conta. A recuperação de senha já está correta (sempre responde sucesso).

É um tradeoff clássico: mensagem clara vs. privacidade. Muitos produtos
aceitam. Só sinalizo para ser decisão consciente.

---

## Endurecer antes da fase de IA

### 🟠 E1 — Grants de coluna largos demais (MÉDIA *na próxima fase*)

Os grants são por tabela, não por coluna:

- **`profiles`**: `grant update` cobre todas as colunas. O usuário pode
  reescrever o próprio `created_at`. (Trocar o `id` é barrado pelo
  `WITH CHECK`.) Impacto hoje: cosmético.
- **`analysis_history`**: `grant insert` deixa o usuário criar linhas com
  `status = 'completed'` e `result` forjado.

Hoje é inócuo — não há IA nem cota. **Vira vetor real no momento em que
existir quota**: o usuário poderia forjar histórico ou, dependendo de como
a cota for contada, manipulá-la.

**Recomendo** antes da fase de IA:

```sql
revoke update on public.profiles from authenticated;
grant  update (name, avatar_url, locale, timezone)
  on public.profiles to authenticated;

revoke insert on public.analysis_history from authenticated;
-- criação de análise passa a ser exclusividade de uma função
-- SECURITY DEFINER que valida entitlement + decrementa cota.
```

### 🟡 E2 — Sem rate limiting próprio

As Server Actions não têm limite de taxa; dependemos apenas dos limites
nativos do Supabase Auth. Antes de produção, avaliar proteção no
`signInAction` e `requestPasswordResetAction`.

---

## Pontos fortes confirmados (com evidência)

| Área | Evidência |
|------|-----------|
| Superfície anônima | 5 tabelas + 4 RPCs + INSERT → todos `42501 permission denied` |
| Middleware | 11 vetores de bypass testados (maiúsculas, `%70`, `//`, `..`, sem locale, barra final) — todos convergem para o guard |
| Escalada a admin | INSERT/UPDATE/DELETE em `user_roles` negados; dupla barreira (sem policy **e** sem grant) |
| Origem do `user_id` | Sempre da sessão no servidor, nunca do payload do cliente |
| Autorização | Não depende de `user_metadata`/`app_metadata` (editáveis pelo usuário) |
| Sessão | `getUser()` (revalida no servidor de Auth) em vez de `getSession()` |
| Service role | Ausente da aplicação; leitura admin via `SECURITY DEFINER` com `is_admin()` interno |
| Isolamento entre contas | Testado nos dois sentidos; escrita cruzada negada |
| CSRF | Server Actions do Next validam Origin/Host nativamente |
| Segredos | Nenhum `service_role` no código; `.env.local` ignorado pelo git |

---

## Não verificado nesta rodada

Sejamos precisos sobre os limites desta auditoria:

1. **Flags reais do cookie de sessão** (`httpOnly`/`Secure`/`SameSite`)
   não foram inspecionadas num tráfego real — a análise de D2 é do
   comportamento documentado do `@supabase/ssr`. Confirmar no DevTools
   assim que houver uma conta real.
2. **Grants no banco** foram lidos das migrations (fonte autoritativa),
   não consultados ao vivo: o MCP do Supabase caiu no meio da auditoria.
   Vale reconferir com `information_schema.role_table_grants`.
3. **Fluxos de e-mail** (confirmação, recuperação, redefinição) seguem sem
   validação ponta a ponta — é exatamente o item 2 do seu plano.
4. **Sem teste de carga/DoS** nem análise de dependências (`npm audit`
   reporta 3 vulnerabilidades moderadas herdadas — vale revisar).

---

---

# Rodada 2 — decisões aplicadas

## D1 — Troca segura de senha ✅ implementado

Os dois fluxos foram **separados**, porque têm requisitos de prova
opostos:

| Fluxo | Action | Exige senha atual? | Prova de posse |
|-------|--------|--------------------|----------------|
| Configurações (usuário logado) | `changePasswordAction` | **Sim** | Conhece a senha |
| Após link de recuperação | `resetPasswordAction` | Não | Acesso ao e-mail |

Como a reautenticação funciona: a senha atual é validada num client
Supabase **isolado** (`persistSession: false`), que não toca nos cookies
do usuário; a sessão temporária criada nessa verificação é encerrada em
seguida, sem deixar sessão órfã no servidor de Auth.

Após qualquer troca de senha — inclusive na recuperação — roda
`signOut({ scope: "others" })`: **todas as outras sessões são
derrubadas**, mantendo só a atual. Isso atende ao objetivo de "invalidar
sessões existentes quando apropriado" e fecha o cenário de cookie
vazado.

Também ativado `secure_password_change = true` no `config.toml` (defesa
em profundidade, ver passo manual no painel).

Novos erros traduzidos: `wrongCurrentPassword`, `reauthNeeded`.

## D2 — Cookie de sessão httpOnly ✅ implementado

**Confirmação técnica exigida antes de mexer.** Verifiquei no código do
`@supabase/ssr@0.5.2`:

1. `document.cookie` só aparece em `cookies.js`, no caminho do
   `createBrowserClient` — que **não usamos** (o arquivo
   `src/lib/supabase/client.ts` foi removido).
2. `DEFAULT_COOKIE_OPTIONS` traz `httpOnly: false`, mas o merge é
   `{ ...DEFAULT_COOKIE_OPTIONS, ...options?.cookieOptions }` — ou seja,
   `cookieOptions` **sobrescreve** o default. É a via oficial do SDK,
   não improviso.
3. O servidor lê os cookies pelo header `Cookie` da requisição, que
   inclui cookies httpOnly. Middleware, refresh de token, Server
   Components e Server Actions seguem funcionando.

Configuração central em `src/lib/supabase/cookie-options.ts`:

```
httpOnly: true                                  → XSS não rouba a sessão
secure:   NODE_ENV === "production"             → só HTTPS em produção
sameSite: "lax"                                 → preserva links de e-mail
path:     "/"        (sem `domain`)             → escopo mínimo, sem subdomínios
```

`secure` fica `false` em desenvolvimento de propósito: com `true` o
navegador recusaria o cookie em `http://localhost`.

**Consequência assumida:** usar `createBrowserClient` no futuro
(realtime, estado de auth no cliente) exige revisar esta decisão. O
arquivo do browser client foi removido justamente para que ninguém o
reintroduza sem perceber.

Sobre os demais requisitos: nada de sessão em `localStorage` (só o
resultado do quiz, que não é sensível), nenhum token em log e nenhum
token interpolado em URL além do callback obrigatório do Supabase — que
já redireciona para um caminho interno limpo.

## E1 — `analysis_history` somente leitura ✅ aplicado e verificado

Migration `20260720130000_analysis_history_readonly.sql`:

```sql
drop policy if exists "analysis_history_insert_own" on public.analysis_history;
revoke insert, update, delete on public.analysis_history from authenticated, anon;
grant select on public.analysis_history to authenticated;
```

Mesma dupla barreira de `user_roles`: **sem policy e sem grant**. O
cliente passa a apenas ler os próprios registros; a criação será
exclusividade de uma operação de servidor que valide entitlement,
decremente cota e defina `status`/`result`.

> ✅ **Aplicada manualmente no SQL Editor** do projeto remoto de dev
> (`supabase/APLICAR-E1-MANUAL.sql`), pelo proprietário, porque o MCP do
> Supabase e a CLI ficaram indisponíveis durante toda esta rodada
> (`net::ERR_FAILED`; CLI sem access token). **Verificado por ele:** a
> consulta final de grants retornou **apenas `SELECT`** para
> `authenticated` — INSERT/UPDATE/DELETE revogados, conforme esperado.
>
> Ressalva de rastreabilidade: eu **não** re-verifiquei de forma
> independente (MCP seguiu fora até o fim). A migration
> `20260720130000_analysis_history_readonly.sql` continua versionada como
> fonte da verdade; ao restaurar MCP/CLI, reconferir com
> `has_table_privilege('authenticated','public.analysis_history','INSERT')`
> (esperado `false`) e rodar o bloco de falsificação de
> `supabase/tests/rls.sql`.

---

## Estado das verificações de runtime

| Verificação | Estado |
|-------------|--------|
| `tsc` + `eslint` | ✅ limpos |
| App sobe com os novos cookieOptions | ✅ 5 rotas públicas em 200 |
| Guards seguem ativos | ✅ painel/admin/redefinir-senha → 307 com `next` |
| Sem erros no log do servidor | ✅ |
| Flag `httpOnly` no cookie real | ⏳ precisa de conta real |
| Troca de senha com senha atual | ⏳ precisa de conta real |
| Derrubada das outras sessões | ⏳ precisa de conta real |
| E1 aplicado no remoto | ✅ aplicado + verificado pelo proprietário (só `SELECT`) |
| E1 teste de falsificação re-executado | ⏳ precisa do MCP/CLI para rodar `rls.sql` |

---

## Recomendação atualizada

1. ~~Aplicar E1 no remoto~~ ✅ **feito** (aplicado e verificado pelo
   proprietário no SQL Editor).
2. **Validar com as duas contas reais** — é o único caminho para fechar
   as verificações de runtime pendentes (cookie httpOnly real, troca de
   senha ponta a ponta, derrubada de sessões, isolamento A×B) e cobre de
   uma vez os fluxos de e-mail do item 2 do plano.
3. Reconferir E1 pela CLI/MCP quando voltarem (higiene de rastreabilidade).
4. Só então liberar o Stripe.
