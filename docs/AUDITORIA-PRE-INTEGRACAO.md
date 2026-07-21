# AUDITORIA TÉCNICA — Desenrole.ai (pré-integração Supabase + Stripe)

Diagnóstico do estado atual antes de iniciar backend real. **Nenhum código
de integração foi escrito.** Este documento é a proposta a ser aprovada.

Base auditada: commit local em `/Users/mateusviana/Downloads/desenrole`,
104 arquivos em `src/`, Next.js 16 + next-intl + Tailwind v4, TypeScript
estrito. Fases concluídas: Blocos 1–4 (landing, quiz, auth visual,
dashboard, ferramentas, jogos, perfil, config, suporte, admin visual).

---

## 1. Resumo executivo da situação atual

A camada visual está **madura e bem organizada**. A separação em route
groups, o padrão de repositórios para quarentenar mocks e a tipagem
estrita criam uma base acima da média para receber backend. **Nada
precisa ser reescrito do zero.**

Porém, a aplicação hoje é **100% pública e sem estado de servidor**:
não existe sessão, autenticação, autorização, nem uma única mutação
real. Todo "salvar/entrar/analisar" é `setTimeout`. O `middleware.ts`
faz apenas roteamento de idioma. **Qualquer visitante acessa
`/pt-BR/admin` e vê o painel administrativo completo** — a única coisa
que decide "quem é admin" hoje é um objeto mockado com `isAdmin: true`.

Conclusão: a estrutura **está pronta para receber backend sem retrabalho
estrutural**, desde que três decisões de design sejam feitas ANTES de
escrever a primeira migration (detalhadas na seção 7): (a) tornar
`getCurrentUser()` nulo e sensível a contexto de requisição; (b) separar
`CurrentUser` em identidade / assinatura / entitlement; (c) separar
`Plan` (comercial) de `plan_price` (espelho da Stripe). Fazer isso depois
custa refatorar todas as telas de novo.

O maior risco NÃO é técnico-estrutural — é que a UI foi construída
assumindo um usuário sempre presente e sempre "premium ativo". Ao ligar
o backend real, é preciso introduzir os estados que hoje não existem:
não-autenticado, autenticado-sem-plano, past_due, quota esgotada.

---

## 2. O que está bem construído

- **Padrão de repositórios (`src/lib/data/`)** — o maior ativo. Todas as
  telas consomem `userRepository`, `plansRepository`, etc. via
  `index.ts`. Nenhuma tela importa fixture direto (verificado por grep).
  Trocar `*.mock.ts` por implementação Supabase é o caminho previsto e
  funciona — com a ressalva da seção 7.
- **Route groups limpos** — `(public)`, `(minimal)`, `(app)`, `(admin)`
  com layouts próprios. A fronteira de "onde entra auth" já está
  fisicamente desenhada: `(app)` e `(admin)` são exatamente os grupos que
  precisam de guarda.
- **Server Components por padrão** — todas as `page.tsx` são Server
  Components async que buscam dados e passam para Client Components só nas
  ilhas interativas (formulários, quiz, jogos, workspace). Padrão correto
  e já compatível com data-fetching server-side autenticado.
- **i18n disciplinado** — zero hardcode confirmado; `getTranslations`
  (server) e `useTranslations` (client) usados corretamente após a
  correção do Bloco 3. Chaves 100% espelhadas entre locales.
- **TypeScript estrito de verdade** — `strict` + `noUncheckedIndexedAccess`.
  `tsc --noEmit` e `eslint .` zerados.
- **Tokens de tema centralizados** — um único acento, nenhum componente
  define cor própria. Migração não toca visual.
- **`.env.example` e `.gitignore` já preparados** — chaves de Supabase e
  Stripe listadas; `.env`, `.env*.local` e `*.tsbuildinfo` ignorados.
  Nenhum segredo commitado, nenhum `process.env` usado ainda.
- **Regra "nunca liberar Premium pelo frontend" respeitada** — o cabeçalho
  de `index.ts` documenta a proibição e ela é cumprida: não há um único
  `setTimeout` liberando acesso, nem gate de premium client-side. O
  terreno do entitlement está limpo (greenfield, nada a arrancar).

---

## 3. O que precisa ser corrigido ANTES da integração

Estes itens são pré-requisitos de design. Não são bugs — são decisões
que, se tomadas na ordem errada, geram refatoração em cascata.

1. **`getCurrentUser(): Promise<CurrentUser>` → `Promise<CurrentUser | null>`.**
   Hoje retorna sempre um usuário. No mundo real, não-autenticado = `null`.
   Todos os chamadores (layouts, painel, perfil, config, admin) assumem
   não-nulo. Definir a assinatura nula **agora**, no contrato, evita
   refatorar cada tela quando o Supabase entrar.
2. **Separar o `CurrentUser` inchado.** Hoje ele mistura identidade
   (`id/name/email/avatar/locale`), estado comercial (`plan`), estado de
   assinatura (`subscriptionStatus/currentPeriodEnd`) e papel (`isAdmin`).
   A arquitetura de entitlements exige que **acesso NÃO seja lido de
   `user.plan`**. Quebrar em `Profile` + `Subscription` + `Entitlements` +
   `role` no contrato de tipos antes de ligar o banco.
3. **Separar `Plan` de `PlanPrice`.** Hoje `Plan` carrega `priceInCents` e
   `currency` inline. Com Stripe como fonte da verdade de preço, isso
   vira duas coisas: `plan` (comercial: slug, features) e `plan_price`
   (espelho de Stripe: `stripe_price_id`, valor, intervalo). A tela de
   pricing deve ler preço do `plan_price`.
4. **Guarda de autenticação em `(app)` e `(admin)`.** Ambos os layouts
   hoje renderizam para qualquer um. Precisam virar Server Components que
   buscam sessão e `redirect('/login')` se nulo; o admin adiciona checagem
   de papel.
5. **Estados de UI ausentes.** A UI só conhece "logado + premium ativo".
   Antes de ligar dados reais, prever: não-autenticado, sem plano,
   `past_due`, quota esgotada, período em processamento. Sem isso, o
   primeiro usuário real sem assinatura quebra as telas.

---

## 4. Riscos críticos

| # | Risco | Onde | Impacto |
|---|-------|------|---------|
| C1 | **Painel admin sem qualquer autorização** | `(admin)/layout.tsx` não checa papel; só renderiza o mock | Vazamento total do painel administrativo assim que houver dados reais de usuários/receita |
| C2 | **Rotas autenticadas sem guarda** | `(app)/*` acessível sem sessão | Dados de outros usuários expostos ao ligar backend, se RLS não for o backstop |
| C3 | **Liberar Premium no retorno do Checkout** | ainda não existe, mas é a tentação óbvia da próxima fase | Fraude trivial (usuário forja retorno); viola a arquitetura aprovada |
| C4 | **Confiar em evento da Stripe como dado** | idem | Estados financeiros errados, períodos duplicados |
| C5 | **Escrita client-side em tabelas financeiras** | se RLS permitir `authenticated` escrever em subscriptions/entitlements | Auto-concessão de Premium via console do navegador |

C1 e C2 são do código atual. C3–C5 são armadilhas da fase seguinte que a
arquitetura desta auditoria previne por design (seções 10–13).

---

## 5. Riscos médios

- **`getCurrentUser` sem contexto de requisição.** A assinatura atual não
  recebe nada; a implementação real precisa ler cookies/sessão. Em Server
  Components isso é resolvível dentro da própria implementação (chamando
  o client Supabase server-side), mas a função precisa virar nula e os
  chamadores precisam tratar `null`.
- **Quiz é só localStorage, pré-auth.** Não há persistência server-side.
  Se o objetivo for atribuir o perfil ao usuário após cadastro, falta um
  ponto de captura no signup. Decisão do dono (seção 19).
- **Preços mockados hardcoded** (`R$ 19,90` / `R$ 49,90`). Placeholders.
  Bloqueado pela decisão de preços reais.
- **Middleware precisará ser composto.** `createMiddleware(routing)` do
  next-intl terá que ser encadeado com o refresh de sessão do Supabase
  SSR, preservando cookies. Padrão conhecido, mas exige cuidado com a
  ordem e o `matcher`.
- **Sucesso de login redireciona para `/`** (landing), não para `/painel`.
  Precisa mudar ao ter dashboard real.
- **Formulários fazem `setTimeout`**, não Server Actions. Migração
  previsível (Client Component chamando Server Action no submit), mas são
  ~6 formulários (cadastro, login, recuperar, editar-perfil, senha,
  contato) + toggles de notificação.

---

## 6. Dívidas técnicas aceitáveis para depois

- **es/fr/it/de são cópias do en.** Já documentado desde o Bloco 1;
  tradução real é pós-lançamento.
- **Sem README.md.** O `HANDOFF.md` cumpre o papel hoje; criar README é
  cosmético.
- **`usage_events` (log append-only) e `feature_flags`/`app_settings`**
  podem ficar para depois do MVP de billing (seção 8).
- **Testes automatizados inexistentes.** Aceitável enquanto tudo é
  visual; deixa de ser aceitável no momento em que a função de sync
  financeiro existir (seção 18 lista os obrigatórios).
- **Jogos e workspace de ferramentas 100% client/mock.** A análise por IA
  e o conteúdo dos jogos podem permanecer mockados até depois do billing.

---

## 7. Arquitetura recomendada

Camadas, de baixo para cima:

```
Postgres + RLS (Supabase)          ← backstop de segurança final
  └─ SECURITY DEFINER functions    ← is_admin(), has_entitlement(), sync
Camada de infra (server-only)
  ├─ src/lib/supabase/{server,client,admin}.ts
  ├─ src/lib/stripe/{client,sync,checkout}.ts
  └─ src/lib/auth/session.ts  (getUser, requireUser, requireAdmin)
Camada de domínio (repositórios — contrato estável)
  └─ src/lib/data/*  (mock → supabase, sem mudar as telas)
Server Actions / Route Handlers    ← toda mutação e lógica financeira
UI (Server + Client Components)    ← inalterada visualmente
```

Princípios:

- **Contrato de repositório imutável para as telas.** As `page.tsx` não
  sabem se o dado vem de mock ou Supabase. Só `index.ts` troca.
- **Toda mutação é Server Action ou Route Handler.** Zero lógica de
  negócio no navegador. Formulários client só coletam e chamam a action.
- **Acesso Premium é derivado, calculado no servidor.** Nunca um booleano
  `is_premium` vindo do cliente. `has_entitlement(feature)` lê a tabela
  `entitlements` (com `granted_until`), no servidor.
- **Defesa em profundidade para autorização:** middleware (redirect) +
  guarda no layout server-side + checagem explícita em cada action + RLS
  no banco. Nenhuma camada confia na anterior.

---

## 8. Estrutura de banco recomendada

A lista enviada (23 tabelas) foi avaliada. **Correção importante: o Bloco
4 removeu Biblioteca e Favoritos** — portanto `content_items`,
`content_categories` e `favorites` **não existem mais** e devem sair do
schema. `content_history` é substituído por `generations` (o Histórico
hoje lista análises de ferramentas).

### Núcleo (v1 — obrigatório)

| Tabela | Papel | Escrita permitida a |
|--------|-------|---------------------|
| `profiles` | 1:1 com `auth.users`. Guarda name, avatar, locale, `role` (enum user/admin), `quiz_profile`, `stripe_customer_id` | dono (colunas neutras); `role`/`stripe_customer_id` só service_role |
| `plans` | Catálogo comercial (weekly/monthly + featureKeys) | service_role |
| `plan_prices` | Espelho de Stripe Price (`stripe_price_id`, amount, currency, interval, active) | service_role (sync) |
| `subscriptions` | Espelho de Stripe Subscription (status, current_period_end, price_id, cancel_at_period_end, `last_event_at`) | service_role (sync) |
| `entitlements` | Direitos derivados (user_id, feature, `granted_until`, source) | service_role / SECURITY DEFINER |
| `checkout_sessions` | Rastreio de session_id (user, price, status) p/ reconciliação no retorno | service_role |
| `webhook_events` | Idempotência: `UNIQUE(stripe_event_id)`, livemode, processed_at | service_role |
| `subscription_sync_log` | Trilha de auditoria de cada sync (source, before/after, event_id) | service_role |
| `usage_quotas` | user, feature, period_start, used, limit | SECURITY DEFINER (transação) |
| `generations` | Cada análise (user, tool, input_ref, output, created_at) — fonte do Histórico | dono INSERT/SELECT próprio |
| `consents` | LGPD: aceite de termos/privacidade + versão + timestamp | dono INSERT; SELECT próprio |
| `support_requests` | Persistência do formulário de contato | dono INSERT; SELECT próprio; admin SELECT |

### Decisões de modelagem

- **`stripe_customers` → coluna `stripe_customer_id` em `profiles`.** Um
  usuário = um customer no nosso caso; tabela separada só se houver
  múltiplos customers por usuário (não é o caso). Fica como coluna.
- **`user_roles` → coluna `role` (enum) em `profiles` para o v1.** RBAC
  completo com tabela dedicada só se surgirem múltiplos papéis
  simultâneos. Caminho de upgrade preservado.
- **`plans` + `plan_prices` separados** é obrigatório dado "Stripe é fonte
  da verdade de preço".

### Adiar (pós-MVP de billing)

- `usage_events` (log append-only de uso — útil para auditoria/analytics,
  mas `usage_quotas` já enforça; começar sem).
- `quiz_sessions` / `quiz_answers` — só se o dono quiser persistir o quiz
  server-side (hoje é localStorage). Alternativa mínima: salvar só o
  `quiz_profile` final em `profiles` no signup.
- `feature_flags` / `app_settings` — sem necessidade no v1.

---

## 9. Fluxo de autenticação recomendado

1. **`@supabase/ssr`** com três clients: `server.ts` (Server Components /
   actions, lê cookies), `client.ts` (browser), `admin.ts` (service role,
   **server-only**, nunca importado por Client Component).
2. **Middleware composto:** refresh de sessão do Supabase (`getUser()` que
   revalida o cookie) **encadeado** com o `createMiddleware(routing)` do
   next-intl, mesclando os cookies de resposta. Ajustar o `matcher` para
   também cobrir as rotas que precisam de refresh de sessão.
3. **Signup/login/recuperar** viram Server Actions chamando Supabase Auth.
   Trigger `on auth.users insert` cria a linha em `profiles`. Consentimento
   LGPD capturado no signup (grava em `consents`).
4. **Guarda de rota:** `(app)/layout.tsx` e `(admin)/layout.tsx` como
   Server Components → `const user = await requireUser()` (redirect
   `/login` se nulo). Admin: `await requireAdmin()` → `notFound()` se não
   for admin (não revela existência da rota).
5. **Nunca confiar só no layout.** Layout é UX; a segurança real é RLS +
   checagem em cada action. Layout pode ser burlado em navegação client.

---

## 10. Fluxo de pagamento recomendado

Fiel à arquitetura aprovada. **Uma única função central e idempotente**
`syncSubscription(stripeSubscriptionId)`:

- **Sempre relê o estado atual na API da Stripe.** O payload do evento é
  só sinal de "vá conferir", nunca dado confiável.
- **Advisory lock** por `stripe_subscription_id`
  (`pg_advisory_xact_lock(hashtext(sub_id))`) — serializa syncs
  concorrentes do mesmo assinante.
- **Descarte out-of-order:** compara `event.created` com
  `subscriptions.last_event_at`; evento mais antigo que o último
  sincronizado é ignorado.
- Escreve o espelho em `subscriptions`, **recalcula `entitlements`**
  (deriva `granted_until` do `current_period_end` + grace period) e grava
  uma linha em `subscription_sync_log` (before/after/source/event_id).
- **Nunca soma dias manualmente**; sempre define o estado absoluto vindo
  da Stripe. Reprocessar o mesmo evento = mesmo estado (idempotente).

**4 caminhos, todos chamando a MESMA função, sem ordem entre si:**

1. **Webhook** (`/api/webhooks/stripe`): route handler com raw body,
   verificação de assinatura, checagem de `livemode` vs ambiente, dedup
   por `webhook_events.stripe_event_id` → chama sync.
2. **Retorno do Checkout:** valida `session_id` pertence ao usuário
   autenticado, resolve a subscription e chama sync (reconciliação).
3. **Cron** (Edge Function agendada, a cada ~5min): varre subscriptions
   ativas E faz varredura reversa (subscriptions na Stripe sem
   contraparte local) → chama sync.
4. **Reprocessamento admin:** botão no painel → chama sync.

**Checkout:** idempotency key determinística (`user + price + janela de
tempo`); metadata na session E em `subscription_data.metadata`. Página de
**processamento** faz polling do entitlement por no máx. 60s, depois
mensagem honesta ("está demorando mais que o normal").

**Critério de aceite central:** com o webhook desligado, um pagamento em
test mode libera acesso em **< 5 min** (via reconciliação/cron), com
trilha de auditoria completa em `subscription_sync_log`.

---

## 11. Fluxo de autorização Premium recomendado

- Acesso **derivado**, nunca booleano cru. `subscriptions` (espelho) →
  `syncSubscription` deriva → `entitlements` (user, feature,
  `granted_until`, source).
- `has_entitlement(user_id, feature)` como função SECURITY DEFINER
  (ou helper server-side): retorna true se existe entitlement com
  `granted_until > now()`.
- **Gate no ponto de uso:** o `tool-workspace` (analisar conversa/story)
  chama uma Server Action que: (1) `requireUser`; (2) `has_entitlement`;
  (3) checa e decrementa `usage_quotas` na mesma transação; (4) só então
  chama a IA; (5) grava `generations`. Free/expirado/quota-esgotada é
  bloqueado no servidor, com mensagem clara na UI.
- **Grace period** em `past_due` (0/3/7 dias — decisão do dono) entra no
  cálculo de `granted_until`, não em lógica espalhada.

---

## 12. Estratégia de RLS

- **RLS habilitado em todas as tabelas, deny-by-default.**
- `profiles`: dono faz SELECT/UPDATE da própria linha, **exceto** colunas
  protegidas (`role`, `stripe_customer_id`, `quiz_profile` se for
  server-managed) — essas só via service_role / função definer.
- `subscriptions`, `entitlements`, `usage_quotas`: dono faz **SELECT**
  próprio; **nenhum INSERT/UPDATE** por `authenticated`. Escrita só
  service_role (sync). Isso mata o risco C5 (auto-concessão de Premium)
  na raiz — o navegador fisicamente não consegue escrever acesso.
- `generations`, `support_requests`: dono INSERT + SELECT próprio.
- `webhook_events`, `subscription_sync_log`, `checkout_sessions`,
  `plans`, `plan_prices`: **service_role apenas**, sem acesso client.
- **Admin:** função `is_admin(auth.uid())` SECURITY DEFINER (lê
  `profiles.role`) usada em policies de SELECT amplo. Escritas
  administrativas passam por Server Actions que **rechecam** `is_admin` e
  usam service role.
- **Otimização opcional:** Auth Hook `custom_access_token_hook` injeta
  `role` no JWT, evitando lookup em `profiles` a cada policy. Deixar para
  depois se a performance pedir.

---

## 13. Estratégia de administração

- **Papel só em `profiles.role`**, definível apenas por SQL/service_role —
  nunca auto-atribuível.
- **Três camadas:** (1) `(admin)/layout.tsx` server-side chama
  `requireAdmin()` → `notFound()` para não-admin; (2) cada Server Action
  administrativa recheca `is_admin` no servidor; (3) RLS como backstop.
- **Logs de ação administrativa** — reaproveitar o padrão de
  `subscription_sync_log` para um `admin_audit_log` (quem, o quê, quando,
  alvo), especialmente para o "reprocessamento manual" de billing.
- O `reprocessamento admin` (caminho 4 do pagamento) é a primeira ação
  administrativa com efeito financeiro — precisa de log obrigatório.

---

## 14. Ordem exata de implementação

Cada etapa é entregável e testável isoladamente.

1. **Infra Supabase SSR** — clients server/client/admin + middleware
   composto (sessão + next-intl). *Aceite:* sessão persiste; rota
   protegida redireciona sem sessão.
2. **Auth real + profiles + consents** — cadastro/login/recuperar via
   Server Actions; trigger de criação de profile; consentimento no signup.
   *Aceite:* signup/login reais; RLS em profiles.
3. **Papel + guarda admin** — coluna `role`, `is_admin`, guarda em
   `(app)`/`(admin)`, recheck nas actions. *Aceite:* não-admin recebe 404
   em `/admin`; não-autenticado é redirecionado.
4. **Catálogo comercial** — `plans` + `plan_prices` semeados/sincronizados
   da Stripe; pricing e subscription-tab lêem `plan_prices`. *Aceite:*
   preço exibido vem da Stripe.
5. **Customer + Checkout + páginas de billing** — criação de customer,
   action de checkout, páginas `/checkout` `/processando` `/sucesso`
   `/erro`. *Aceite:* session criada; `session_id` validado contra usuário
   no retorno.
6. **Núcleo de sync** — `syncSubscription` idempotente + advisory lock +
   guarda out-of-order; `subscriptions` + `entitlements` +
   `subscription_sync_log`. *Aceite:* sync duas vezes = mesmo estado, sem
   período duplicado.
7. **Webhook** — route handler com assinatura/livemode/dedup → sync.
   *Aceite:* webhook desligado, sistema ainda converge via reconciliação.
8. **Reconciliação (retorno + cron + reprocesso admin)** — todos os
   caminhos convergindo. *Aceite:* **critério central** — pagamento test
   mode com webhook off libera acesso < 5min, com trilha completa.
9. **Entitlement gate + quotas + generations** — `has_entitlement`, gate
   no workspace, enforcement de quota, gravação de generation (substitui
   histórico mock). *Aceite:* free bloqueado ao esgotar quota; premium
   ilimitado; generation logada e visível no Histórico.
10. **Legal + consent gating** — páginas de Termos/Privacidade
    (versionadas), signup exige consentimento. *Aceite:* signup sem
    consentimento é bloqueado; versão registrada.

Billing (4–8) só começa depois das decisões de preço/trial/grace.

---

## 15. Arquivos que deverão ser CRIADOS

- `src/lib/supabase/server.ts`, `client.ts`, `admin.ts`
- `src/lib/auth/session.ts` (`getUser`, `requireUser`, `requireAdmin`)
- `src/lib/entitlements/has-entitlement.ts`
- `src/lib/stripe/client.ts`, `sync.ts`, `checkout.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/[locale]/(minimal)/checkout/page.tsx`,
  `processando/page.tsx`, `sucesso/page.tsx`, `erro/page.tsx`
  (ou um route group `(billing)` dedicado)
- `src/app/[locale]/(public)/termos/page.tsx`, `privacidade/page.tsx`
- `actions.ts` por área: auth, perfil, suporte, checkout, admin
- `src/lib/data/*.supabase.ts` (implementações reais, trocadas em
  `index.ts`)
- `supabase/migrations/*.sql` (uma por etapa da seção 14)
- Edge Function de cron (reconciliação)

## 16. Arquivos que deverão ser ALTERADOS

- `src/middleware.ts` — compor Supabase + next-intl
- `src/app/[locale]/(app)/layout.tsx` e `(admin)/layout.tsx` — guarda real
- `src/lib/data/index.ts` — trocar mock → supabase
- `src/lib/data/types.ts` — `getCurrentUser` nulo; quebrar `CurrentUser`
  em `Profile`/`Subscription`/`Entitlements`/`role`; separar `Plan` de
  `PlanPrice`
- `src/components/auth/*` (3 forms), `profile/edit-profile-form`,
  `settings/account-tab`, `settings/notifications-tab`,
  `support/contact-form` — `setTimeout` → Server Action
- `src/components/settings/subscription-tab.tsx` e
  `marketing/pricing.tsx` — ler `plan_prices`, CTA de checkout real
- `src/components/tools/tool-workspace.tsx` — upload real + gate de
  entitlement + quota + gravação de generation
- `src/components/auth/login-form.tsx` — redirect de sucesso p/ `/painel`
- `.env.example` — adicionar `APP_URL`, secret do cron se necessário

## 17. Migrations necessárias (ordem)

1. `profiles` + trigger de signup + RLS
2. `consents` + RLS
3. `role` em profiles + `is_admin()` + policies admin
4. `plans` + `plan_prices` + RLS
5. `subscriptions` + `entitlements` + `checkout_sessions` + `stripe_customer_id`
6. `webhook_events` + `subscription_sync_log` + advisory-lock helpers
7. `usage_quotas` + `generations` + `has_entitlement()` + decremento transacional
8. `support_requests` + RLS
9. (opcional) `admin_audit_log`

---

## 18. Testes obrigatórios

Deixam de ser opcionais a partir da etapa 6 (lógica financeira).

- **Idempotência:** `syncSubscription` chamado 2× (mesmo evento e evento
  repetido) → mesmo estado, sem período duplicado.
- **Out-of-order:** evento antigo após evento novo → sem regressão de
  estado.
- **Webhook:** assinatura inválida rejeitada; `livemode` divergente
  rejeitado; `stripe_event_id` duplicado ignorado.
- **RLS:** usuário A não lê subscription/entitlement/generation de B;
  `authenticated` não consegue escrever em entitlements/subscriptions;
  não-admin não lê dados administrativos.
- **Entitlement/quota:** `granted_until` expirado → sem acesso; quota
  esgotada → bloqueado; premium ativo → liberado.
- **Autorização:** não-autenticado → redirect; não-admin → 404 em admin.
- **Reconciliação:** com webhook desligado, pagamento test mode concede
  acesso em < 5min (o critério central, automatizado).

---

## 19. Decisões que dependem do proprietário

Bloqueiam schema/lógica difíceis de desfazer. As 6 do HANDOFF + 3 novas:

1. Existem clientes pagantes hoje? (migração vs greenfield)
2. **Preços reais** dos planos (bloqueia `plan_prices`, etapa 4)
3. **Grace period** em `past_due`: 0/3/7 dias? (bloqueia derivação de
   `granted_until`)
4. Política de **reembolso/disputa** sobre o acesso (comportamento do sync
   em eventos `charge.refunded` / `dispute`)
5. **Provedor de IA** + teto de gerações por ciclo (bloqueia
   `usage_quotas` + `generations`, etapa 9)
6. **Trial gratuito**: sim/não? (bloqueia status de assinatura e checkout)
7. **(nova)** Persistir o quiz server-side? Ou só gravar `quiz_profile` no
   signup? (define se `quiz_sessions/quiz_answers` existem)
8. **(nova)** Papel: coluna enum em `profiles` (recomendado v1) ou
   `user_roles` dedicada (futuro multi-papel)?
9. **(nova)** `stripe_customer_id` como coluna em `profiles` (recomendado)
   ou tabela `stripe_customers` separada?

---

## 20. Critérios de aceite por etapa

(consolidado da seção 14 — cada etapa só fecha quando o critério passa)

| Etapa | Critério de aceite |
|-------|--------------------|
| 1 Infra | Sessão persiste entre requests; rota protegida redireciona sem sessão |
| 2 Auth | Signup/login reais; profile criado por trigger; RLS ativa em profiles |
| 3 Admin gate | Não-admin → 404 em `/admin`; não-autenticado → redirect |
| 4 Catálogo | Preço exibido vem da Stripe (`plan_prices`), não hardcoded |
| 5 Checkout | Session criada; `session_id` validado contra usuário no retorno |
| 6 Sync | Sync 2× = mesmo estado; zero período duplicado; log gravado |
| 7 Webhook | Assinatura/livemode/dedup corretos; chama sync |
| 8 Reconciliação | **Webhook off → acesso < 5min + trilha completa** |
| 9 Entitlement | Free bloqueado ao esgotar quota; premium ilimitado; generation logada |
| 10 Legal | Signup sem consentimento bloqueado; versão registrada |

---

**Fim do diagnóstico. Nenhum código de integração foi escrito. Aguardando
aprovação e as respostas da seção 19 antes de iniciar a etapa 1.**
