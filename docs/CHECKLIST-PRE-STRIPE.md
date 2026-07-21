# CHECKLIST PRÉ-STRIPE — Marco oficial da fundação

> **STATUS: FUNDAÇÃO CONGELADA (oficial).** Decisão do proprietário. Este
> é o documento oficial da base. A arquitetura atual está preservada e
> **não recebe novas alterações estruturais** — apenas correção de bugs
> críticos. A validação operacional com contas reais (R1) foi
> **deliberadamente adiada** para ser refeita durante a homologação
> completa da Fase Stripe (ver nota em Riscos/Pendências). A próxima fase
> é **exclusivamente Stripe**, e só inicia sob prompt específico.

Auditoria completa da fundação (banco, segurança, auth, cookies, Server
Actions, middleware, estrutura) antes de qualquer lógica de pagamento.
Serve como **congelamento da arquitetura atual**.

- **Escopo:** auditoria e documentação. Nenhum código, migration, tabela,
  policy ou arquivo foi alterado para produzir este documento.
- **Projeto de dev:** `desenrole-gringa-dev` (ref `mwpxxxwkvceeobaurgls`).
- **Método de verificação do banco:** as migrations versionadas em
  `supabase/migrations/` são a fonte da verdade. O MCP do Supabase e a
  CLI estiveram **indisponíveis** nas últimas rodadas, então o estado
  "aplicado" reflete o que foi confirmado por push/execução anteriores e,
  no caso de E1, pela verificação manual do proprietário no SQL Editor.
  Itens que dependem de re-verificação ao vivo estão marcados.

---

# 1. Banco de Dados

## Migrations (ordem de execução = ordem cronológica dos nomes)

| # | Arquivo | Conteúdo | Estado |
|---|---------|----------|--------|
| 1 | `20260720120000_identity.sql` | enum `app_role`; `profiles`; `user_roles`; `set_updated_at`; `handle_new_user` + trigger; `has_role`; `is_admin`; índices; RLS de profiles e user_roles | Aplicada |
| 2 | `20260720120100_quiz_results.sql` | enum `quiz_profile`; `quiz_results` (+ idempotência); índice; RLS | Aplicada |
| 3 | `20260720120200_analysis_history.sql` | enums `analysis_type`/`analysis_status`; `analysis_history`; índices; RLS (inclui policy de INSERT — depois revogada) | Aplicada |
| 4 | `20260720120300_support_requests.sql` | enums `support_subject`/`support_status`; `support_requests`; índices; RLS | Aplicada |
| 5 | `20260720120400_harden_functions.sql` | `search_path` fixo em `set_updated_at`; revoga EXECUTE de `handle_new_user`/`has_role`; restringe `is_admin` a `authenticated` | Aplicada |
| 6 | `20260720120500_admin_read_functions.sql` | `admin_list_users`, `admin_get_user`, `admin_stats` (SECURITY DEFINER com `is_admin()` interno) | Aplicada |
| 7 | `20260720130000_analysis_history_readonly.sql` | **E1**: drop da policy de INSERT + revoke INSERT/UPDATE/DELETE de `analysis_history` | Aplicada manualmente (SQL Editor) e verificada pelo proprietário — grants para `authenticated` = só `SELECT` |

## Dependências entre migrations

- **1 é pré-requisito de todas:** define `is_admin()`, usada nas policies
  de 2, 3, 4, 6 e 7; e o enum `app_role`.
- **5 depende de 1** (endurece funções criadas nela).
- **6 depende de 1–4** (lê profiles, user_roles, quiz_results, support).
- **7 depende de 3** (modifica `analysis_history`).
- Sequência é linear e sem ciclos. `supabase db reset` aplica na ordem
  dos timestamps.

> ⚠️ **Ordenação intencional:** `profiles` e `user_roles` estão na mesma
> migration (1) de propósito — as policies de `profiles` dependem de
> `is_admin()` (que lê `user_roles`) e o trigger de signup escreve nas
> duas. Separar criaria um estado intermediário inválido.

## Tabelas (5)

| Tabela | Papel | Colunas-chave |
|--------|-------|---------------|
| `profiles` | Identidade 1:1 com `auth.users` | id, name, avatar_url, locale, timezone, created_at, updated_at |
| `user_roles` | RBAC | (user_id, role) PK; enum `user`/`admin` |
| `quiz_results` | Resultado final do quiz | user_id, client_result_id (UNIQUE p/ idempotência), profile, scores, version, completed_at |
| `analysis_history` | Histórico de análises (preparada p/ IA) | user_id, tool, status, input_ref, result, created_at |
| `support_requests` | Chamados de suporte | user_id (nullable), subject, message, status, created_at |

**Sem informação financeira em nenhuma tabela** — Stripe entra em tabelas
próprias na próxima fase.

## Índices (6, além das PKs)

- `user_roles_role_idx (role)` — listar admins
- `quiz_results_user_completed_idx (user_id, completed_at desc)` — último quiz
- `analysis_history_user_created_idx (user_id, created_at desc)` — histórico
- `analysis_history_status_idx (status)` — worker futuro de IA
- `support_requests_user_created_idx (user_id, created_at desc)`
- `support_requests_status_idx (status)` — fila do admin

## Triggers (2)

- `on_auth_user_created` → `handle_new_user()`: cria `profiles` + concede
  **só** o papel `user`. Nenhum caminho concede `admin`.
- `profiles_set_updated_at` → `set_updated_at()`.

## Funções (8)

| Função | Tipo | Exposta na API? |
|--------|------|-----------------|
| `handle_new_user()` | SECURITY DEFINER, trigger | Não (EXECUTE revogado) |
| `set_updated_at()` | trigger, search_path fixo | Não |
| `has_role(uuid, app_role)` | SECURITY DEFINER, stable | **Não** (EXECUTE revogado) |
| `is_admin()` | SECURITY DEFINER, stable | Sim, só `authenticated` (necessário p/ policies) |
| `admin_list_users()` | SECURITY DEFINER | Sim, `authenticated`; `is_admin()` interno |
| `admin_get_user(uuid)` | SECURITY DEFINER | Sim, `authenticated`; `is_admin()` interno |
| `admin_stats()` | SECURITY DEFINER | Sim, `authenticated`; `is_admin()` interno |

## Views / RPCs

- **Views:** nenhuma.
- **RPCs (chamáveis via PostgREST):** `is_admin`, `admin_list_users`,
  `admin_get_user`, `admin_stats`. Todos exigem papel de admin
  internamente ou só revelam ao próprio chamador.
- Enums de domínio: `app_role`, `quiz_profile`, `analysis_type`,
  `analysis_status`, `support_subject`, `support_status`.

## Observações importantes

- `analysis_history` está preparada para a IA mas **fica vazia** — não há
  criação pelo produto nesta fase (e agora é somente-leitura para o
  cliente).
- A leitura administrativa **não usa service role** — usa funções
  SECURITY DEFINER. A service role não existe na aplicação.

---

# 2. Segurança

## RLS por tabela (todas com RLS ativo, deny-by-default)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `profiles` | dono ou admin | — (só trigger) | dono (própria linha) / admin | — |
| `user_roles` | dono ou admin | **nenhuma** | **nenhuma** | **nenhuma** |
| `quiz_results` | dono ou admin | dono | — | — |
| `analysis_history` | dono ou admin | **nenhuma (E1)** | **nenhuma** | **nenhuma** |
| `support_requests` | dono ou admin | dono | admin | — |

## Grants (defesa em profundidade, além do RLS)

- `anon`: **nenhum grant** em nenhuma tabela → barrado antes do RLS
  (`42501 permission denied`). Confirmado ao vivo via PostgREST na
  auditoria de segurança.
- `authenticated`:
  - `profiles`: SELECT, UPDATE
  - `user_roles`: **SELECT apenas** (sem INSERT/UPDATE/DELETE)
  - `quiz_results`: SELECT, INSERT
  - `analysis_history`: **SELECT apenas** (E1 revogou o resto)
  - `support_requests`: SELECT, INSERT, UPDATE

## Roles

- `user`: padrão de todo cadastro.
- `admin`: concedido **apenas** por SQL/service_role (procedimento
  documentado em `docs/FASE-BANCO-E-IDENTIDADE.md`).

## Confirmação: nenhuma escrita indevida disponível a `authenticated`

- **`user_roles`**: dupla barreira (sem policy **e** sem grant de escrita)
  → **impossível auto-promoção a admin**. Testado: INSERT/UPDATE/DELETE
  negados.
- **`analysis_history`**: dupla barreira após E1 → cliente **não** pode
  forjar `status`/`result`/consumo. Verificado pelo proprietário.
- **`profiles`**: usuário só atualiza a própria linha (WITH CHECK em
  `id = auth.uid()`). Ver risco R3 (grant de UPDATE é por-tabela, não
  por-coluna).
- **`quiz_results`/`support_requests`**: INSERT só com
  `user_id = auth.uid()` — impossível gravar em nome de terceiro.

Estado: **nenhuma escrita indevida conhecida** para `authenticated`.

---

# 3. Autenticação

| Item | Implementação | Estado |
|------|---------------|--------|
| Login | `signInAction` → `signInWithPassword` | ✅ testado (usuário de dev) |
| Logout | `signOutAction` → `signOut` + redirect | ✅ testado |
| Cadastro | `signUpAction` → `signUp` + trigger cria profile/role | ⚠️ caminho de dados provado; e-mail real pendente |
| Recuperação | `requestPasswordResetAction` (sempre responde sucesso) | ⚠️ e-mail real pendente |
| Redefinição | `resetPasswordAction` (pós-link) + `signOut(others)` | ⚠️ e-mail real pendente |
| Troca de senha | `changePasswordAction` — **exige senha atual** + `signOut(others)` | ⚠️ runtime pendente |
| Callback | `/[locale]/auth/callback/route.ts` — PKCE e token_hash | ⚠️ runtime pendente |
| Middleware | compõe next-intl + refresh de sessão | ✅ |
| SSR | `@supabase/ssr`, `createServerClient` | ✅ |
| Sessão | cookie httpOnly, `getUser()` (revalida) | ✅ persiste após reload (testado) |
| Refresh | no middleware, a cada request | ✅ |
| Guards | `requireUser` (app) / `requireAdmin` (admin, → 404) | ✅ testado |
| Redirecionamentos | visitante→login com `?next`; logado→painel | ✅ testado |

## Open redirect

**Permanece corrigido.** `safeInternalPath()` (`src/lib/locale-path.ts`)
bloqueia esquema absoluto, `//`, `\` e `..`; aplicado no login e no
callback de e-mail. Vetores `https://evil.com`, `//evil.com`,
`javascript:` e `../` retornam `null` → cai no padrão `/painel`.

---

# 4. Cookies

Config central: `src/lib/supabase/cookie-options.ts`, aplicada no
`server.ts` e no `middleware.ts` via `cookieOptions` (via oficial do SDK,
que faz `{ ...DEFAULT, ...cookieOptions }`).

| Flag | Valor | Motivo |
|------|-------|--------|
| `httpOnly` | `true` | JS não lê o cookie → XSS não rouba a sessão. Possível porque **nenhum** Client Component fala com o Supabase (browser client removido) |
| `secure` | `true` só em produção | Em `http://localhost` o navegador recusaria `secure=true` |
| `sameSite` | `lax` | Preserva o retorno dos links de e-mail (navegação top-level) e barra POST cross-site |
| `path` | `/` | Válido em toda a app |
| `domain` | **não definido** | Escopo mínimo: só o host atual, não vaza para subdomínios |

- **localhost:** `secure=false`, `httpOnly=true`, `sameSite=lax` — sessão
  funciona.
- **produção (esperado):** `secure=true` (HTTPS obrigatório); demais
  iguais.
- **Contrapartida assumida:** usar `createBrowserClient` no futuro
  (realtime, auth reativo no cliente) exige rever `httpOnly`.

> ⚠️ Evidência de runtime da flag `httpOnly` em tráfego real ainda
> **pendente** (precisa de login com conta real). A configuração está
> correta no código; falta observar o `Set-Cookie` real.

---

# 5. Server Actions

9 Server Actions, em 4 arquivos `"use server"`. `ActionResult` é um
export **de tipo** (apagado na compilação, não vira endpoint).

| Action | Finalidade | Autenticação | Validação | Abuso | Riscos |
|--------|-----------|--------------|-----------|-------|--------|
| `signUpAction` | Cadastro | pública | Zod (name/email/senha≥8) | rate limit nativo do Supabase | Enumeração de e-mail via `emailTaken` (R6) |
| `signInAction` | Login | pública | Zod | rate limit nativo | Sem rate limit próprio (R5) |
| `signOutAction` | Logout | sessão | — | — | — |
| `requestPasswordResetAction` | Pedir recuperação | pública | Zod (email) | responde sempre sucesso (anti-enumeração) | Sem rate limit próprio (R5) |
| `resetPasswordAction` | Nova senha pós-link | sessão (do link) | Zod (senha≥8) | derruba outras sessões | — |
| `changePasswordAction` | Trocar senha logado | sessão + **reautenticação** | Zod; valida senha atual em client isolado | derruba outras sessões | — |
| `claimQuizResultAction` | Persistir quiz pós-login | sessão | Zod; `user_id` da sessão | idempotente (client_result_id UNIQUE) | — |
| `updateProfileAction` | Editar identidade | sessão | Zod (name/email) | e-mail novo exige confirmação | — |
| `createSupportRequestAction` | Criar chamado | sessão | Zod (subject/mensagem 10–5000) | — | Sem rate limit próprio (R5) |

**Padrões confirmados:**
- Toda action revalida os dados no servidor com Zod (schema do cliente é
  só UX).
- `user_id` sempre vem de `getUser()` no servidor, **nunca** do payload.
- CSRF: Server Actions do Next validam Origin/Host nativamente.
- **Nenhuma Server Action morta ou exposta sem necessidade.**
  `resolvePostLoginPath` (morta) foi removida na auditoria de segurança.

---

# 6. Middleware

Fluxo completo (`src/middleware.ts`):

1. **next-intl** resolve o idioma (pode reescrever/redirecionar).
2. **Supabase** `updateSession()` renova a sessão sobre a resposta do
   next-intl (via `getUser()`, que revalida no servidor de Auth),
   preservando os cookies.
3. Separa locale do path (`splitLocalePath`).
4. **Visitante em rota protegida** → `307` para
   `/{locale}/login?next=<destino>` (destino preservado).
5. **Autenticado em rota de auth** → `307` para `/{locale}/painel`.

| Categoria | Rotas |
|-----------|-------|
| Públicas | `/`, landing, quiz, resultado, `/login`, `/cadastro`, `/recuperar-senha` |
| Privadas (`PROTECTED_PREFIXES`) | `/painel`, `/ferramentas`, `/jogos`, `/historico`, `/perfil`, `/configuracoes`, `/suporte`, `/redefinir-senha` |
| Admin | `/admin` (guard extra `requireAdmin` no layout → 404) |
| Auth (`AUTH_PREFIXES`) | `/login`, `/cadastro`, `/recuperar-senha` |

- `matcher`: `/((?!api|_next|_vercel|.*\..*).*)`.
- `/redefinir-senha` é protegida mas **fora** de AUTH_PREFIXES de
  propósito (o link de recuperação cria sessão; redirecionar para o painel
  quebraria o fluxo).
- **Defesa em profundidade:** middleware (redirect) + guard no layout
  server-side + RLS no banco. Testado contra 11 vetores de bypass
  (maiúsculas, `%70`, `//`, `..`, sem locale, barra final) — todos
  convergem para o guard.

---

# 7. Estrutura do Projeto

```
src/
├─ app/[locale]/
│  ├─ (public)/     landing            → sem auth
│  ├─ (minimal)/    quiz, resultado, auth, redefinir-senha → chrome mínimo
│  ├─ (app)/        painel, ferramentas, jogos, historico, perfil,
│  │                configuracoes, suporte → requireUser
│  ├─ (admin)/      admin/* → requireAdmin (404 p/ não-admin)
│  └─ auth/callback/route.ts → troca de código de e-mail
├─ components/      admin, auth, dashboard, games, history, layout,
│                   marketing, profile, quiz, settings, shell, support,
│                   tools, ui   (Server por padrão; Client só nas ilhas)
├─ lib/
│  ├─ supabase/     server.ts, middleware.ts, cookie-options.ts  (infra)
│  ├─ auth/         session.ts (getCurrentUser/getUserRoles/isCurrentUserAdmin/
│  │                requireUser/requireAdmin), actions.ts
│  ├─ quiz/ profile/ support/  actions.ts (Server Actions por domínio)
│  ├─ data/         index.ts (fachada) + *.supabase.ts (real) + *.mock.ts
│  │                (catálogo estático) + types.ts
│  ├─ locale-path.ts, quiz-scoring.ts, format.ts, utils.ts, nav-config.ts
│  └─ ...
├─ i18n/            routing.ts, request.ts, navigation.ts
├─ messages/        6 locales
└─ middleware.ts
```

**Responsabilidades:**
- **Repositories** (`lib/data/*`): dado de usuário via Supabase+RLS;
  catálogo/conteúdo via mock estático. Fachada única em `index.ts` — as
  telas não sabem a origem.
- **Services/lib** (`lib/supabase`, `lib/auth`): infra e sessão.
- **Actions** (`lib/**/actions.ts`): toda mutação; validação server-side.
- **Components**: Server por padrão, Client só nas ilhas interativas.
- **Hooks**: **não há pasta `hooks/`** — a lógica reativa vive nos poucos
  Client Components. Não é problema; é simplicidade adequada ao tamanho.
- **App Router**: 4 route groups isolam o chrome e a fronteira de auth.

**Pontos de refatoração antes do Stripe:** nenhum estrutural. A base já
prevê a separação identidade / assinatura / entitlements (o `CurrentUser`
é só identidade), que é exatamente o que a fase Stripe precisa. Ver
seção 10.

---

# 8. Pendências

## Obrigatórias antes do Stripe

1. ~~Validação de runtime dos fluxos de auth com contas reais~~
   **→ movida para a homologação da Fase Stripe** (decisão do
   proprietário). Será refeita naturalmente ali: cadastro→confirmação→
   login, recuperação, redefinição, reuso/expiração de link, troca de
   senha ponta a ponta, cookie httpOnly em tráfego real, isolamento A×B.
2. **Decisões de negócio que travam o schema de pagamento**
   (as "PENDÊNCIAS DE DECISÃO" do HANDOFF): preços reais, trial (sim/não),
   grace period em `past_due`, política de reembolso/disputa sobre o
   acesso, provedor de IA + teto de gerações, clientes pagantes hoje.
3. **Acesso administrativo restaurado** (MCP ou CLI autenticada) para
   aplicar as migrations da fase Stripe de forma versionada.

## Podem esperar

- Persistência das preferências de notificação (hoje visual).
- Páginas de Termos de Uso e Privacidade (referenciadas desde o Bloco 1).
- Exclusão de conta (desabilitada na UI).
- Upload de avatar / edição de foto (previsto no bloco intermediário
  de auth).
- Re-verificação independente de E1 pela CLI/MCP (higiene).
- es/fr/it/de são cópias do en.

## De produção

- SMTP próprio (o nativo tem limite baixo e restrição de destinatários).
- Rate limiting próprio nas actions públicas.
- `npm audit`: 3 vulnerabilidades moderadas herdadas — revisar.
- `secure=true` garantido por HTTPS; projeto de produção separado.
- Custom access token hook (papel no JWT) como otimização de RLS.

---

# 9. Riscos

| ID | Risco | Sev. | Impacto | Probabilidade | Mitigação |
|----|-------|------|---------|---------------|-----------|
| R1 | Fluxos de e-mail não validados ponta a ponta | **Alto** | Bug latente em confirmação/recuperação só apareceria com usuário real; mina a base do checkout (que depende de conta confirmada) | Média | **Decisão do proprietário: validação movida para a homologação da Fase Stripe** (será refeita naturalmente ali, com contas reais). Aceito conscientemente até lá |
| R2 | Tooling do Supabase indisponível (MCP/CLI) | **Alto** | Sem via versionada para aplicar migrations do Stripe; E1 precisou ser manual | Presente hoje | Restaurar MCP ou autenticar CLI (`SUPABASE_ACCESS_TOKEN`) antes de iniciar |
| R3 | Grant de UPDATE em `profiles` é por-tabela | Baixo | Usuário pode reescrever o próprio `created_at` (cosmético; `id` é barrado) | Baixa | `revoke update` + `grant update (name, avatar_url, locale, timezone)` — fazer junto com a fase de IA |
| R4 | Cookie httpOnly não observado em runtime | Médio | Config correta no código, mas sem evidência real; um erro de merge passaria despercebido | Baixa | Inspecionar `Set-Cookie` no primeiro login real |
| R5 | Sem rate limiting próprio nas actions públicas | Médio | Brute force / spam de e-mail dependem só do limite nativo do Supabase | Média | Rate limit em `signIn`/`requestPasswordReset` antes de produção |
| R6 | Enumeração de e-mail no cadastro | Baixo | Descobrir quais e-mails têm conta | Média | Decisão consciente (mensagem clara vs. privacidade); recuperação já é anti-enumeração |
| R7 | Confirmação de e-mail rejeita domínios de teste | Baixo | Impede testes automatizados com e-mails fake | Presente | Usar e-mails reais ou desligar "Confirm email" em dev |

Nenhum risco **crítico** (que impeça o design do Stripe) em aberto. R1 e
R2 são gates operacionais para **iniciar** a implementação.

---

# 10. Critérios para iniciar Stripe

**A arquitetura está pronta para receber Stripe?**
Sim, arquiteturalmente. O padrão de repositórios permite adicionar
`subscriptions`/`entitlements` sem tocar nas telas; o `CurrentUser` é só
identidade (assinatura será consulta separada, como a arquitetura de
entitlements exige); a leitura administrativa e o RLS já seguem o modelo
que o Stripe vai reusar; nenhuma tabela mistura financeiro com identidade.

**Existe algum bloqueio técnico?**
Sim, dois operacionais (não estruturais): **R1** (fluxos de e-mail não
validados com contas reais) e **R2** (tooling do Supabase indisponível
para aplicar migrations versionadas). Ambos precisam ser resolvidos
**antes de iniciar a implementação**, não antes de projetá-la.

**Existe dívida técnica crítica?**
Não. As dívidas conhecidas (R3, R5, R6) são baixas/médias e endereçáveis
na fase de IA ou de produção, sem retrabalho estrutural.

**Alteração estrutural recomendada antes dos pagamentos?**
Nenhuma. A fundação já está no formato que o Stripe precisa. As adições
serão puramente aditivas (novas tabelas, novas funções de sync, novas
Server Actions), sem refatorar o que existe.

---

# 11. Plano da próxima fase — Stripe

Consistente com a "ARQUITETURA DE PAGAMENTO APROVADA" do HANDOFF.
**Isto é plano, não implementação.**

## Arquitetura proposta

- **Stripe é a fonte da verdade financeira.** O banco local é espelho.
- **Evento da Stripe nunca é dado confiável** — é sinal de "vá conferir":
  toda sincronização relê o estado atual na API da Stripe.
- **Acesso Premium derivado, no servidor** — nunca um booleano
  `is_premium` vindo do cliente. `has_entitlement(feature)` lê a tabela
  `entitlements`.
- **4 caminhos pares convergindo na MESMA função idempotente**
  `syncSubscription(stripe_subscription_id)`: webhook, retorno do
  checkout, cron de reconciliação, reprocessamento admin. Nenhum depende
  de ter rodado antes/depois de outro.

## Tabelas propostas (aditivas)

`plans`, `plan_prices` (espelho de Stripe Price), `subscriptions`
(espelho), `entitlements` (direitos derivados), `checkout_sessions`,
`stripe_customers` (ou coluna em `profiles`), `webhook_events`
(UNIQUE stripe_event_id), `subscription_sync_log` (auditoria). Todas com
RLS: cliente **SELECT** próprio; escrita **só service_role**.

## Fluxo de checkout

1. Server Action cria/recupera o **Customer** (`stripe_customer_id`).
2. Cria **Checkout Session** com idempotency key determinística
   (`user + price + janela`), metadata na session **e** em
   `subscription_data.metadata`.
3. No retorno, valida `session_id` contra o usuário autenticado →
   reconciliação (chama `syncSubscription`).
4. **Tela de processamento:** polling do entitlement por ≤ 60s, depois
   mensagem honesta.

## Subscription / sincronização / idempotência

- `syncSubscription` sempre **relê a Stripe**, aplica **advisory lock** por
  `stripe_subscription_id`, **descarta eventos out-of-order** (compara
  `event.created` com o último sincronizado), escreve o espelho e
  **recalcula `entitlements`** (deriva `granted_until` de
  `current_period_end` + grace period). **Nunca soma dias manualmente** —
  define o estado absoluto. Grava trilha em `subscription_sync_log`.

## Webhooks

- Route handler com **raw body**, verificação de assinatura, checagem de
  `livemode` vs ambiente, dedup por `webhook_events.stripe_event_id` →
  chama `syncSubscription`.

## Reconciliação / cancelamento / renovação

- **Cron (~5min):** varre subscriptions ativas **e** faz varredura
  reversa (subscriptions na Stripe sem contraparte local).
- **Cancelamento/renovação:** refletidos pela própria releitura de estado
  na Stripe — nada de lógica de calendário local.
- **Portal do Cliente:** Stripe Billing Portal para o usuário gerir/
  cancelar; o retorno reconcilia.

## Falhas / retries / eventos

- Webhook responde rápido; trabalho pesado é idempotente e reexecutável.
- `past_due` respeita o grace period (decisão do dono) no cálculo do
  entitlement.
- Reembolso/disputa: comportamento a definir (decisão do dono) — o sync
  relê e ajusta o entitlement conforme a política.

## Segurança

- Toda lógica financeira **no servidor**; nunca no navegador.
- Tabelas financeiras **não graváveis** por `authenticated` (só
  service_role) — o RLS é o backstop, como já é para `user_roles`.
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) só no servidor.

## Testes obrigatórios

- Idempotência (sync 2×/evento repetido = mesmo estado, sem período
  duplicado).
- Out-of-order (evento antigo após novo → sem regressão).
- Webhook (assinatura inválida rejeitada; livemode divergente rejeitado;
  event_id duplicado ignorado).
- RLS (cliente não lê/gera subscription/entitlement de outro).
- Entitlement/quota (expirado → sem acesso; quota esgotada → bloqueado).
- **Critério de aceite central:** com webhook desligado, pagamento em
  test mode libera acesso em **< 5 min** com trilha de auditoria completa.

---

# Veredito

## A fundação está pronta para iniciar Stripe?

**Não ainda — mas falta pouco, e nada estrutural.**

**Arquiteturalmente: sim.** A base está sólida e pode ser congelada como
está. O padrão de repositórios, a separação identidade/assinatura, o RLS
deny-by-default, os guards em profundidade e o `CurrentUser` só-identidade
são exatamente o formato que o Stripe precisa. Não há dívida técnica
crítica nem refatoração recomendada. As adições da fase Stripe serão
puramente aditivas.

**Operacionalmente:** o proprietário **congelou a fundação** e definiu o
tratamento dos dois gates (nenhum estrutural):

1. **R1 — validação com contas reais → movida para a homologação da Fase
   Stripe.** Será refeita naturalmente ali; aceito conscientemente até lá.
   Deixa de ser gate de bloqueio da fundação.
2. **R2 — restaurar o acesso administrativo ao Supabase** (MCP ou CLI com
   token) segue necessário para aplicar as migrations do Stripe de forma
   versionada — primeira coisa a resolver quando a fase começar.

Além disso, **6 decisões de negócio** (preços, trial, grace period,
reembolso, provedor de IA, clientes atuais) são **entradas** obrigatórias
do schema de pagamento — precisam vir com o prompt de início da fase.

**Resumo objetivo:** a casa está construída, nivelada e **oficialmente
entregue**. A vistoria com energia ligada (R1) foi agendada para a
homologação do Stripe; ao iniciar a fase, basta reconectar as ferramentas
(R2) e o proprietário informar os acabamentos (as 6 decisões). A fundação
está encerrada e congelada.
