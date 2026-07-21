# HANDOFF — Desenrole.ai (continuação de projeto)

Cole este documento no primeiro prompt do novo chat, junto com o zip do projeto.

---

## CONTEXTO

Reconstrução da plataforma Desenrole.ai — SaaS de assistência de conversas
(Instagram/WhatsApp) para homens, posicionamento de comunicação/confiança
(NUNCA manipulação). Assinatura recorrente semanal e mensal via Stripe
Checkout hospedado. Supabase como banco/auth. Internacional (6 idiomas).

## ESTRATÉGIA ATUAL

Estamos na fase de CONSTRUÇÃO VISUAL COMPLETA com dados mockados.
A integração real (Supabase + Stripe) vem depois, seguindo arquitetura
já aprovada (resumida abaixo em "ARQUITETURA DE PAGAMENTO APROVADA").
Com o Bloco 3, essa fase visual está praticamente concluída — dá pra
navegar quase todo o SaaS (público + autenticado + admin) sem nenhum
backend real. Ver "DECISÃO DO DONO — REORDENAÇÃO DA SEQUÊNCIA" abaixo.

## ESTADO — BLOCO 1 CONCLUÍDO (43 arquivos no zip)

Pronto:
- Next.js 15 + TypeScript estrito + Tailwind v4 + tokens de tema em globals.css
- i18n: next-intl, 6 locales (pt-BR canônico, en traduzido, es/fr/it/de são
  cópias temporárias do en), localePrefix: "always"
- Design system: base #0A0A0B, acento único âmbar #E6A23C, 8 primitivos UI
  em src/components/ui (padrão shadcn escrito à mão)
- Landing completa: hero com demo de chat, como funciona, ferramentas,
  provas sociais (COPY ILUSTRATIVA — trocar antes do ar), pricing, FAQ,
  CTA final, header/footer
- Camada de mocks QUARENTENADA em src/lib/data/ atrás de repositórios
  tipados. REGRA: telas nunca importam fixtures direto; na integração real
  só os *.mock.ts são substituídos.
- PROIBIDO: qualquer lógica que simule confirmação de pagamento
  (setTimeout liberando premium etc). Telas de billing são visuais puras.

Preços mockados: R$ 19,90/semana, R$ 49,90/mês (placeholders).

## ESTADO — BLOCO 2 CONCLUÍDO

Construído, seguindo o design system existente, em nova route group
`[locale]/(minimal)` (chrome mínimo — logo + seletor de idioma, sem
header/footer de marketing):

- Quiz: uma pergunta por tela (6 perguntas, 4 opções cada), barra de
  progresso, animação fade-up por pergunta, persistência local
  (localStorage, chave `desenrole:quiz:v1`, retomável), rota
  `/[locale]/(minimal)/quiz`. Pontuação pura em `src/lib/quiz-scoring.ts`
  (não é mock — fica fora da camada de dados). Dados do quiz (perguntas
  + 4 perfis) em `src/lib/data/quiz.mock.ts`, atrás de `quizRepository`.
- Resultado personalizado: `/[locale]/(minimal)/resultado/[slug]`,
  `generateStaticParams` a partir dos 4 perfis (observador, direto,
  ansioso, quase-la), cada um com pontos fortes/fracos e ferramenta
  recomendada (reaproveita copy de `landing.tools`).
- Auth visual: cadastro, login, recuperar senha — React Hook Form + Zod,
  shell reutilizável (`AuthCard`), estados de sucesso inline (sem
  redirecionar para rotas ainda não construídas), toggle mostrar/ocultar
  senha, zero lógica Supabase real.
- Traduções: novos namespaces `common`, `quiz`, `result`, `auth` em
  pt-BR e en (chaves 100% espelhadas, verificado por diff), propagados
  para es/fr/it/de como cópia do en (mesma convenção do Bloco 1).
- Verificado de ponta a ponta no navegador: fluxo do quiz (pontuação e
  redirect corretos), retomada após reload, páginas de resultado em
  pt-BR e en, os 3 formulários de auth (validação + sucesso), 404 para
  slug de resultado inválido, mobile. `tsc --noEmit` limpo. ESLint ainda
  não está configurado no projeto (mesmo estado do Bloco 1 — não foi
  mexido).

## DECISÃO DO DONO — REORDENAÇÃO DA SEQUÊNCIA (pós-Bloco 2)

O dono pediu para inverter a ordem original: construir TODA a experiência
de usuário (autenticada + admin) primeiro, 100% visual, e só depois
iniciar a integração real (Supabase + Stripe). O Bloco 3 abaixo cobriu
de uma vez o que estava dividido em "Blocos 3–6" no planejamento antigo
(Planos/Checkout/Dashboard, Ferramentas/Histórico/Favoritos, Biblioteca/
Perfil/Config/Suporte, Admin) — exceto Checkout/Processando de pagamento
real, que continua fora de escopo até a integração.

## ESTADO — BLOCO 3 CONCLUÍDO

App autenticado inteiro navegável, 100% mockado, em duas novas route
groups (chrome próprio, sidebar desktop + drawer mobile, mesmo design
system):

- `[locale]/(app)` — área do usuário: `/painel` (dashboard/home),
  `/ferramentas` + `/ferramentas/[slug]` (workspace com geração fake —
  loading simulado, 3 sugestões de exemplo por ferramenta, copiar pro
  clipboard real), `/biblioteca` + `/biblioteca/[slug]` (filtro por
  categoria, detalhe com corpo de aula, relacionados, marcar concluído
  local), `/historico`, `/favoritos`, `/perfil` + `/perfil/editar`,
  `/configuracoes` (tabs: Conta com troca de senha + danger zone
  desabilitada, Assinatura, Notificações com switches, Idioma),
  `/suporte` (FAQ em accordion + formulário de contato).
- `[locale]/(admin)` — painel administrativo, sidebar separada:
  `/admin` (KPIs + usuários recentes), `/admin/usuarios` (busca +
  filtro de status) `+ /admin/usuarios/[id]`, `/admin/biblioteca`
  (tabela de conteúdos), `/admin/planos` (preços/features, edição
  desabilitada com nota "quando o Stripe estiver ativo"). Escopo do
  admin foi decisão própria (o pedido original só citava "Painel
  Administrativo" genericamente) — dá pra revisar se o dono quiser algo
  diferente (ex.: moderação/denúncias, que não fazia sentido pro produto
  atual por não ter conteúdo gerado por usuário).
- Shell compartilhado em `src/components/shell/*`, parametrizado por
  `navItems` (`src/lib/nav-config.ts`) — mesmo Sidebar/Topbar/MobileNav/
  UserMenu servem `(app)` e `(admin)`.
- Novos primitivos hand-rolled (sem Radix): Avatar, Tabs, Textarea,
  Switch, Select, Accordion em `src/components/ui/`.
- Novos mocks: `admin.mock.ts` (stats + 10 usuários), `support.mock.ts`
  (FAQ), `NotificationSettings` em `user.mock.ts`, `bodyKey` em
  `ContentItem` (corpo de aula), `memberSince` em `CurrentUser`.
- `AuthSuccess` virou `SuccessPanel` (movido pra `ui/`) — reaproveitado
  fora do fluxo de auth (perfil, config, suporte).
- Bug real encontrado e corrigido: ícones do Lucide não podem atravessar
  a fronteira Server → Client Component como prop (função não é
  serializável). `nav-config.ts` guarda o nome do ícone como string;
  `NavList` (client) resolve pro componente real. Mesmo padrão que já
  existia em `tool-icons.tsx`.
- ESLint configurado pela primeira vez (`eslint.config.mjs`, flat config
  `next/core-web-vitals` + `next/typescript` — não existia desde o
  Bloco 1). Isso pegou um padrão errado espalhado pelas páginas novas:
  `useTranslations`/`useLocale` (hooks síncronos) chamados dentro de
  Server Components `async` quebram a regra `react-hooks/rules-of-hooks`
  mesmo funcionando em runtime. Corrigido em todas as pages `async` do
  Bloco 3 trocando para `getTranslations`/`getLocale` de
  `next-intl/server` (await). Regra prática: hook síncrono só em
  componente não-async; em `page.tsx` async, sempre a versão `get*`.
- Traduções: namespaces `shell`, `dashboard`, `tools` (+ `.catalog` e
  `.workspace`), `library` (+ `.categories` e `.items`), `history`,
  `favorites`, `profile` (+ `.edit`), `settings` (+ 4 sub-namespaces),
  `support` (+ `.faq` e `.contact`), `admin` (+ `.dashboard`, `.users`,
  `.library`, `.plans`) — pt-BR e en escritos à mão, chaves 100%
  espelhadas (verificado por diff), propagados para es/fr/it/de.
- Verificado no navegador, desktop e mobile (375px): todas as rotas
  novas, geração de sugestão numa ferramenta, detalhe de conteúdo,
  tabs de configurações, drawer mobile, admin completo, locale en.
  Bug de overflow horizontal em mobile encontrado e corrigido (topbar
  ficava apertado com hambúrguer + logo + seletor de idioma + avatar —
  seletor de idioma agora oculto abaixo do breakpoint `sm`, idioma
  continua acessível em Configurações). `tsc --noEmit` e `eslint .`
  limpos, zero erros e zero avisos.

## ESTADO — BLOCO 4 CONCLUÍDO (simplificação de produto + Jogos)

Bloco exclusivamente de UX, decidido pelo dono antes da integração real.
Sem backend, sem mudança de arquitetura.

REMOVIDO por decisão do dono (sem código morto):
- Biblioteca inteira: rotas `(app)/biblioteca`, `(admin)/admin/biblioteca`,
  `components/library/*`, `content.mock.ts`, tipos `ContentItem`/
  `ContentCategory`, namespaces `library` e `admin.library`, item de nav.
- Favoritos: rota, atalhos, stats do painel/perfil, namespace `favorites`.
- As 7 ferramentas antigas baseadas em texto.

FERRAMENTAS (simplificadas para exatamente 2, foco em print):
- `analisar-conversa` ("Analisar conversa" — print do WhatsApp/Direct) e
  `analisar-story` ("Analisar Story dela" — print do Story do Instagram).
  `ToolSlug` agora só tem esses 2 valores.
- Página `/ferramentas` com visual premium (glow, cards grandes).
- Workspace novo (`tool-workspace.tsx`): upload de imagem com preview
  (URL.createObjectURL), botão analisar, loading elegante, 3 sugestões
  mockadas (i18n) com copiar pro clipboard e "Gerar novamente".
  A análise é 100% fake (setTimeout) — IA real entra na integração.
- Landing (`tools-showcase`), quiz (`QuizProfile.toolSlug`), histórico
  mock e `plans.featureKeys` atualizados para o novo catálogo
  (featureKey `library` virou `games`).

NOVA ÁREA — JOGOS (`/jogos`, item "Jogos" na nav principal):
- 3 seções colapsáveis (`components/games/game-section.tsx`); Roleta
  expandida por padrão, demais recolhidas. OBS: o dono citou uma "imagem
  de referência" que NÃO chegou anexada — o layout seguiu a descrição
  textual; se a imagem aparecer, conferir divergências.
- Roleta do Flerte: roda SVG de 8 fatias com emojis, animação real de
  giro (CSS transition 4s com cubic-bezier de desaceleração, 5 voltas +
  offset aleatório, resultado sorteado no onTransitionEnd), card de
  resultado com emoji + título + desafio. 40 desafios.
- Baralho da Sincronia: deck visual empilhado, filtro por nível
  (Todas/Leve/Romântico/Quente), "Comprar carta" sorteia do pool.
  80 cartas (27 leve / 27 romântico / 26 quente).
- Verdade ou Consequência: dois botões, card com badge do tipo.
  100 verdades + 100 consequências.
- Todo o conteúdo dos jogos vive nos arquivos de mensagem (t.raw),
  não em mocks TS — é texto traduzível, segue a regra de zero hardcode.
  pt-BR e en escritos à mão; es/fr/it/de continuam cópia do en.
- Dashboard: agora saudação + 2 ferramentas + card Jogos + atividade
  recente (stats de biblioteca/favoritos saíram).

Validação: `tsc --noEmit` e `eslint .` zerados (foi preciso limpar
`.next/` — tipos gerados apontavam pra rotas deletadas). Testado no
navegador desktop e mobile: roleta girando de ponta a ponta, compra de
carta, verdade/consequência, upload+análise fake nas 2 ferramentas,
rotas removidas retornando 404, locale en, zero erros de console.

## ESTADO — FASE BANCO & IDENTIDADE CONCLUÍDA (sem Stripe)

Detalhes completos em `docs/FASE-BANCO-E-IDENTIDADE.md`.

- **Projeto Supabase novo e isolado:** `desenrole-gringa-dev`
  (ref `mwpxxxwkvceeobaurgls`, us-east-1, US$ 10/mês). O projeto antigo
  com clientes reais NÃO foi tocado. Produção será um terceiro projeto,
  criado só no lançamento.
- **6 migrations versionadas** em `supabase/migrations/`: profiles,
  user_roles, quiz_results, analysis_history, support_requests, mais
  endurecimento de funções e as funções de leitura administrativa.
- **Auth real:** cadastro, login, logout, recuperação e redefinição de
  senha via Server Actions + `@supabase/ssr`. Middleware compõe next-intl
  com o refresh de sessão e barra visitante em rota protegida
  preservando o destino (`?next=`).
- **RBAC:** tabela `user_roles`. Todo cadastro recebe só `user`;
  promoção a admin apenas por SQL (procedimento documentado). Usuário
  comum recebe **404** em `/admin` — esconder o menu não é segurança.
- **RLS completo**, deny-by-default. `anon` não tem grant nenhum.
  `user_roles` é ilegível para escrita por `authenticated`, com dupla
  barreira (sem policy + sem grant) contra auto-promoção.
- **Sem service role key na aplicação.** A leitura administrativa usa
  funções SECURITY DEFINER que checam `is_admin()` internamente. Menos
  raio de impacto; a chave só volta na fase Stripe.
- **Mocks de usuário eliminados** (`user.mock.ts`, `admin.mock.ts`
  removidos). `CurrentUser` agora é só identidade; papéis e (futuramente)
  assinatura são consultas separadas. Catálogo estático (planos,
  ferramentas, perguntas do quiz, FAQ) segue mock — não é dado de usuário.
- **Quiz reivindicado de forma idempotente** após o login, com
  `client_result_id` + UNIQUE no banco; o dado local só é apagado após a
  confirmação de gravação.
- **Zero dados fictícios no banco.** Histórico e assinatura exibem
  estados vazios/neutros honestos.
- Testado com 5 personas direto no banco (anon, usuário A, usuário B,
  admin, service role) — suíte reproduzível em `supabase/tests/rls.sql`.
  `tsc` e `eslint` limpos.

**Pendências desta fase** (detalhadas no doc): cadastro/e-mails não
validados ponta a ponta (GoTrue rejeita domínios de teste — precisa de um
e-mail real ou desligar a confirmação em dev); stack local nunca rodado
(Docker ausente); notificações sem persistência; Termos/Privacidade
inexistentes.

## ESTADO — AUDITORIA DE SEGURANÇA PRÉ-STRIPE

Relatório completo em `docs/AUDITORIA-SEGURANCA-PRE-STRIPE.md`.

Revisão adversarial sondando o sistema em execução (não só leitura de
código). Resultado: **nenhuma falha crítica**; superfície anônima
totalmente fechada (5 tabelas + 4 RPCs + escritas → `42501`); middleware
resistiu a 11 vetores de bypass.

**Corrigido:**
- 🔴 **Open redirect no `?next=` do login** (ALTA). O valor da URL ia
  direto ao `router.replace()`; `https://evil.com` e `//evil.com`
  passavam. Vetor de phishing com login legítimo no domínio verdadeiro.
  Novo `safeInternalPath()` bloqueia esquema absoluto, `//`, `\` e `..`.
  Mesmas regras no callback de e-mail.
- Server Action morta (`resolvePostLoginPath`) exposta como endpoint
  público — removida. **Regra: em arquivo `"use server"`, exportar é
  publicar.**

**D1 — troca segura de senha (aprovado, implementado):** os dois fluxos
foram separados. `changePasswordAction` (configurações) **exige a senha
atual**, validada num client isolado que não toca nos cookies;
`resetPasswordAction` (pós link de recuperação) não exige, pois a prova
é o acesso ao e-mail. Ambos rodam `signOut({scope:"others"})` e derrubam
as demais sessões. `secure_password_change = true` no config.toml.

**D2 — cookie httpOnly (aprovado, implementado):** confirmado no código
do `@supabase/ssr@0.5.2` que `cookieOptions` sobrescreve os defaults e
que `document.cookie` só é usado pelo browser client — que não usamos e
foi **removido**. Sessão agora `httpOnly` + `secure` (prod) +
`sameSite=lax` + `path=/` sem `domain`. XSS deixa de roubar sessão.
Contrapartida assumida: usar `createBrowserClient` no futuro exige rever.

**E1 — `analysis_history` somente leitura:** migration
`20260720130000_analysis_history_readonly.sql` remove policy e grant de
INSERT/UPDATE/DELETE (dupla barreira). ✅ **Aplicada** manualmente no SQL
Editor pelo proprietário (o MCP e a CLI ficaram fora a rodada inteira) e
**verificada por ele**: os grants de `analysis_history` para
`authenticated` ficaram só em `SELECT`. Falta reconferir pela CLI/MCP
quando voltarem e re-rodar o bloco de falsificação de
`supabase/tests/rls.sql` (higiene de rastreabilidade).

**Pendências de runtime** (precisam das 2 contas reais — os e-mails ainda
não foram fornecidos): flag `httpOnly` no cookie real, troca de senha
ponta a ponta, derrubada de sessões, isolamento A×B em runtime, e todos
os fluxos de entrega de e-mail (confirmação, recuperação, reuso/expiração
de link).

## 🔒 FUNDAÇÃO CONGELADA — decisão oficial do proprietário

A fundação (banco, identidade, auth, segurança) está **oficialmente
encerrada e congelada**. Documento oficial da base:
`docs/CHECKLIST-PRE-STRIPE.md` (auditoria completa das 11 dimensões +
plano da Fase Stripe).

Regras deste congelamento:
- **Nenhuma alteração estrutural** — só correção de bugs críticos.
- Arquitetura atual **preservada** integralmente.
- A **validação de runtime com contas reais (R1)** foi deliberadamente
  **adiada para a homologação da Fase Stripe** — não é mais pendência em
  aberto da fundação; será refeita naturalmente ali.
- Próxima fase é **exclusivamente Stripe** e só inicia sob **prompt
  específico** do proprietário.

Ao iniciar a Fase Stripe, resolver primeiro: (a) **R2** — restaurar acesso
admin ao Supabase (MCP ou CLI com `SUPABASE_ACCESS_TOKEN`) para migrations
versionadas; (b) as **6 decisões de negócio** (preços reais, trial, grace
period, reembolso/disputa, provedor de IA + teto de gerações, clientes
pagantes hoje) — são entradas do schema.

## FASE STRIPE — S0 + S1 CONCLUÍDAS (código); S1 pendente de aplicar no remoto

Arquitetura oficial: `docs/ARQUITETURA-STRIPE.md` (escopo V1 congelado:
1 plano Premium, US$ 9,90/mês USD, sem trial/upgrade/cupom).

**S0 — infraestrutura (feito):** SDK `stripe@17.7.0` instalada;
`src/lib/stripe.ts` (singleton preguiçoso server-only — lazy p/ o
`next build` não quebrar sem chaves); env vars Stripe em `.env.example` e
`.env.local` (vazias); webhook `src/app/api/webhooks/stripe/route.ts` com
raw body + verificação de assinatura + checagem de livemode, **sem lógica
de negócio**. Rota fora do matcher do middleware.

**S1 — modelagem (código feito, APLICAÇÃO PENDENTE):** 6 migrations
(`2026072014xxxx`) com 6 enums + 8 tabelas (`stripe_customers`, `plans`,
`plan_prices`, `subscriptions`, `entitlements`, `checkout_sessions`,
`webhook_events`, `subscription_sync_log`) + índices + RLS deny-by-default
+ seed do plano Premium. Escrita financeira só service_role (cliente só lê
o próprio; webhook_events/sync_log invisíveis ao cliente).

⚠️ **Não aplicadas no remoto:** MCP e CLI do Supabase seguem fora
(`net::ERR_FAILED`, sem token). Aplicar via SQL Editor com
`supabase/APLICAR-STRIPE-S1-MANUAL.sql`; testar com
`supabase/tests/stripe_rls.sql`; rollback com
`supabase/ROLLBACK-STRIPE-S1.sql`.

✅ **Seed com Price real** `price_1TvOXEB3cMXjTDhl4AvrRizX`
(= `STRIPE_MONTHLY_PRICE_ID`), sem placeholder. Combinado e migration
prontos para aplicar de uma vez.

**Decisões de negócio fechadas** (para S2+): grace period `past_due` =
**3 dias**; cron de reconciliação = **Supabase Scheduled Functions**;
clientes = **greenfield** (sem migração); reembolso/disputa = **remove
acesso imediatamente**; `stripe_customers` = **tabela própria**.
(Atualizar `docs/ARQUITETURA-STRIPE.md` §13 no início da S2 — ainda lista
D1/D3/D4/D9 como abertas.)

**PARADA OBRIGATÓRIA após S1.** Não avançar para checkout/portal/
syncSubscription sem novo prompt.

## FASE STRIPE — S2 (Checkout) + S3 (Webhook + Sync) CONCLUÍDAS (código)

Implementadas juntas. Regra-mãe respeitada: **o retorno do checkout nunca
libera Premium** — quem concede é `syncSubscription` relendo a Stripe e
gravando `entitlements`. Nenhuma página consulta a Stripe para decidir
acesso; o acesso é decidido **só** por `entitlements.granted_until > now()`.

**Núcleo (server-only):**
- `src/lib/supabase/admin.ts` — client service_role (lazy, `server-only`),
  usado só pela sincronização financeira.
- `src/lib/stripe/entitlement-logic.ts` — lógica **pura** de estado→acesso
  (active/trialing→period_end; past_due→+3d; canceled→period_end;
  unpaid/incomplete/paused→sem acesso) + `shouldApplyEvent` (guarda
  fora-de-ordem). **11 testes** `node:test` passando (`npx tsx --test`).
- `src/lib/stripe/customer.ts` — `getOrCreateStripeCustomer` (idempotência
  por `idempotencyKey` + unique em `stripe_customers`, sem duplicar).
- `src/lib/stripe/sync.ts` — **`syncSubscription` central** (fontes:
  webhook / checkout_return / cron(futuro) / admin(futuro)). Relê a Stripe,
  identifica o usuário (stripe_customers + metadata validado), guarda
  fora-de-ordem via `subscriptions.latest_event_at`, faz upsert idempotente
  de `subscriptions` + `entitlements` + trilha em `subscription_sync_log`.
- `src/lib/entitlements.ts` — `hasPremiumAccess()` / `getSubscriptionSummary()`
  (leitura RLS do próprio usuário; nunca lê a Stripe).
- `src/lib/data/billing.supabase.ts` — `billingRepository.getPremiumPrice()`
  (lê `plan_prices`; alimenta pricing/configurações).

**S2 Checkout:**
- `src/lib/stripe/actions.ts` — `createCheckoutSessionAction` (exige login;
  bloqueia se já Premium; **reaproveita** sessão `open` válida e registra em
  `checkout_sessions` p/ evitar sessões múltiplas; usa só
  `STRIPE_MONTHLY_PRICE_ID`, 1 item, qty 1, sem trial/cupom/promocode;
  `idempotencyKey`); `reconcileCheckoutReturnAction` (1 tentativa de sync no
  retorno, valida posse); `checkPremiumStatusAction` (polling).
- Páginas `checkout/processando` (+ `premium-poll` client: reconcilia →
  faz polling do entitlement local até 60s → redireciona ao painel; com
  timeout + mensagem se o webhook demorar) e `checkout/cancelado`.
- UI atualizada: `subscription-tab` + `subscribe-button` (anti-duplo-clique)
  e `marketing/pricing` agora mostram **só o Premium US$ 9,90/mês** (lido do
  banco). Removidos os 2 planos BRL mockados.

**S3 Webhook + Sync:**
- `src/app/api/webhooks/stripe/route.ts` — assinatura obrigatória
  (`constructEvent`), livemode vs ambiente, **dedup atômico** via
  `record_webhook_event` (incrementa `attempts` no retry), roteia
  `checkout.session.completed` / `customer.subscription.*` / `invoice.paid` /
  `invoice.payment_failed` → `syncSubscription`; `charge.refunded` /
  `charge.dispute.created` são **registrados como `skipped` (adiado p/ S5)**;
  marca resultado com `mark_webhook_event`; resposta rápida; logs sem
  segredos/PII (payload mínimo: object_id + type).
- Migration nova `20260720150000_webhook_events_attempts.sql` (coluna
  `attempts` + funções atômicas `record_webhook_event` /
  `mark_webhook_event`, executáveis só por service_role).

⚠️ **Aplicar no remoto:** rodar `supabase/APLICAR-STRIPE-S3-MANUAL.sql` no
SQL Editor do projeto de **development** (idempotente; pré-requisito: S1
aplicada). O MCP do Supabase voltou a responder nesta sessão — pode-se
aplicar por ele também, mas mantivemos a convenção de aplicação manual
revisável.

**Validações executadas:** `tsc --noEmit` limpo; `eslint` limpo; `next
build` OK (webhook = rota dinâmica); **11** testes de lógica pura passando;
varredura do bundle client → **nenhum** segredo, nome de env secreta ou
módulo server-only (`syncSubscription`/`createAdminClient`) vazado.

**Dependem de config/execução manual** (Stripe real): fluxo end-to-end de
checkout, entrega de webhook, cenários de estado (active/past_due/unpaid/
canceled), idempotência/duplicata/fora-de-ordem contra a Stripe real.
Exigem `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` no `.env.local` e
`stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

**Env vars necessárias:** `STRIPE_SECRET_KEY` (só `.env.local`/hosting,
nunca versionar), `STRIPE_WEBHOOK_SECRET` (o `whsec_` do `stripe listen`
ou do endpoint no dashboard), `STRIPE_MONTHLY_PRICE_ID`
(`price_1Tvd3MB3cMXjTDhIsTcj4CV0` em dev/test),
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_APP_URL` (opcional; usado nos success/cancel URLs).

**Config do webhook na Stripe:** endpoint `https://SEU_DOMINIO/api/webhooks/stripe`
(domínio a definir no deploy). Eventos a selecionar:
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid`, `invoice.payment_failed` (e, para a S5,
`charge.refunded` + `charge.dispute.created`). Local: `stripe listen
--forward-to localhost:3000/api/webhooks/stripe` → copiar o `whsec_` para
`STRIPE_WEBHOOK_SECRET`.

**PARADA OBRIGATÓRIA após S3.** Fora do escopo desta fase (próximas):
Customer Portal, cron de reconciliação, refund/dispute completos (S5),
Termos/Privacidade, e IA real das 2 ferramentas.

## FASE STRIPE — S4a: GATE DE ASSINATURA (correção crítica de autorização)

**Bug encontrado:** conta autenticada acessava painel/ferramentas sem
assinatura. Causa: o controle de acesso parava na autenticação —
`middleware` e `(app)/layout` só checavam sessão; `hasPremiumAccess()`
existia mas não era chamado como gate em nenhuma rota. Banco/leitura já
eram seguros (signup não cria entitlement; sem linha → sem acesso).

**Correção (sem tocar schema/RLS):**
- `src/lib/auth/require-premium.ts` — `requirePremium()` (páginas: redireciona
  para `/planos`) e `premiumApiGuard()` (route handlers: 401 `AUTH_REQUIRED`
  / 403 `SUBSCRIPTION_REQUIRED`). Critério único: `hasPremiumAccess()`.
- Route group `(app)/(premium)/` com `layout.tsx` que chama `requirePremium()`.
  `painel`, `ferramentas`, `jogos`, `historico` movidos para dentro — **URLs
  inalteradas** (route group é transparente; confirmado no build). Gate
  centralizado → nenhuma rota premium escapa.
- `(app)/planos/page.tsx` — página de planos (auth-only, FORA do premium):
  destino de quem está logado sem assinatura; se já premium → painel.
- `middleware.ts` — `/planos` adicionado a `PROTECTED_PREFIXES` (visitante →
  login). Middleware segue na camada de auth; o gate de assinatura é
  server-side (não-burlável) + RLS de backstop.
- i18n `planos.*` nos 6 locales.

**Fluxo final:** quiz → cadastro+confirmação → cai em `/painel` → gate →
`/planos` → checkout → webhook/syncSubscription concede entitlement →
`/painel` liberado.

**Rotas premium (gate):** painel, ferramentas, jogos, historico.
**Auth-only (sem assinatura):** planos, configuracoes, perfil, suporte, checkout.

**Validado:** tsc/eslint limpos; `next build` OK (URLs premium preservadas);
11 testes de lógica de acesso passando. Não há API premium hoje (ferramentas
são mock client-side) — `premiumApiGuard` fica pronto para o endpoint real da IA.
Testes A/B/G (redirect) e F (webhook duplicado) são cobertos por
middleware+gate e pela dedup da S3; E2E completo depende de Supabase/Stripe
reais. O preview local desta máquina serve o outro projeto (lara-web), então
a validação foi por build/tsc/testes, não pelo preview.

**Produção:** `NEXT_PUBLIC_APP_URL` deve ser a URL pública HTTPS na Vercel
(ex.: `https://desenrole-ai-jq8i.vercel.app`) — nunca localhost. Documentado
em `.env.example`. O código já prefere essa env e cai no host da request.

## FASE STRIPE — S4b: HOME COMO PORTA DE ENTRADA (checkout antes da conta)

**Decisão do dono:** a home vira só porta de entrada. Novo cliente:
Home → "Começar" (quiz EXTERNO) → checkout Stripe → pago → conta criada →
painel. Cliente existente: Home → "Entrar" → login → painel (se entitlement).

**Implementado:**
- `src/components/marketing/start-cta.tsx` — CTA "Começar" que lê
  `NEXT_PUBLIC_EXTERNAL_QUIZ_URL`. Sem a var → botão desabilitado + mensagem
  segura (home não quebra). Mesma aba. Sem localhost, sem quiz interno, sem
  locale anexado (só se o quiz externo aceitar).
- Home religada (hero, site-header, final-cta, pricing): "Começar" → externo;
  "Entrar" → `/login`. Removidos CTAs de cadastro/checkout direto.
- **Quiz interno removido** do fluxo visual/rotas: deletados
  `(minimal)/quiz`, `(minimal)/resultado`, `components/quiz/{quiz-flow,
  result-view,quiz-claim-on-mount}`, `components/auth/cadastro-form`; removido
  `QuizClaimOnMount` de painel/planos e o claim do login. **Tabelas/dados de
  quiz preservados** (lib de dados mantida, só desligada da UI).
- `/cadastro` → **redireciona para a home** (sem cadastro público). Link
  "criar conta" removido do login.
- `/planos` reformulado: "Sua assinatura não está ativa" (login sem
  entitlement cai aqui via gate; bloqueia + informa; sem cadastro grátis).
- `.env.example`: `NEXT_PUBLIC_EXTERNAL_QUIZ_URL=` (Vercel configura depois).

**Validado:** tsc/eslint limpos; `next build` OK; `/quiz` e `/resultado`
removidos das rotas; i18n paridade 440/440. (E2E clicável impossível aqui — o
preview local serve o outro projeto `lara-web`.)

### S4c: CRIAÇÃO DE CONTA PÓS-CHECKOUT (revisado por auditoria de segurança)

**Decisão do dono:** o webhook NÃO cria contas. A conta nasce só quando o
usuário volta do checkout, em `/criar-conta`. **Revisão de segurança do
dono** (após a primeira implementação) apontou dois problemas corrigidos
aqui: (1) a "proteção" contra duas contas não era atômica — o usuário era
criado ANTES de qualquer reserva de sessão; (2) o `session_id` sozinho
bastava para definir senha (bastava alguém obter a URL de retorno). A
versão abaixo substitui INTEIRAMENTE a primeira (que usava
`admin.auth.admin.createUser` — removida do código).

**Claim atômico (migration nova):**
`supabase/migrations/20260721120000_checkout_claim.sql` +
`supabase/APLICAR-STRIPE-S4-CLAIM-MANUAL.sql` (aplicação manual, mesmo
padrão de S1/S3 — **ainda não aplicada no banco**, ver pendência abaixo):
- `claim_checkout_session(_session_id, _user_id)` — `INSERT ... ON CONFLICT
  DO NOTHING` (nunca sobrescreve dono anterior; vínculo imutável) +
  `SELECT` do dono real. Atômico via o índice único já existente
  (`checkout_sessions_stripe_checkout_session_id_key`, confirmado aplicado
  no Postgres do projeto dev). Duas chamadas concorrentes: só uma
  "vence"; a outra recebe `claimed=false` → código `CHECKOUT_ALREADY_CLAIMED`.
  Mesmo usuário chamando de novo → `claimed=true` (retomada idempotente).
  `SECURITY DEFINER`, `search_path=''`, `EXECUTE` só para `service_role`.
- `email_has_account(_email)` — true **só** para conta com **senha real**
  (`encrypted_password` não vazio). Uma conta OTP ainda sem senha (o
  próprio usuário no meio do fluxo) não conta como "já tem conta" — evita
  travar a pessoa que está terminando o próprio cadastro. Mesmo padrão de
  segurança da função acima.

**Posse do e-mail por OTP nativo do Supabase** (não cria conta por Admin
API): `signInWithOtp` + `verifyOtp`. O e-mail nunca vem do cliente — é
sempre extraído da Checkout Session validada na Stripe.
- `supabase/templates/otp.html` (novo) + `config.toml`
  (`auth.email.template.magic_link`) — nenhum template anterior tinha
  `{{ .Token }}`; sem isso o e-mail chegaria sem código para digitar.
  **Aplicação no projeto remoto é manual** (Dashboard → Authentication →
  Email Templates → Magic Link, ou `supabase config push` com CLI linkado)
  — não há tooling MCP para isso.

**Ordem final das operações** (`src/lib/stripe/account-actions.ts`):
1. `requestCheckoutOtpAction` — revalida a sessão na Stripe → `email_has_account`
   (bloqueia se já existe conta com senha) → `signInWithOtp` (e-mail só do
   servidor).
2. `verifyCheckoutOtpAction` — revalida a sessão de novo → `verifyOtp` →
   confirma `auth.user.email === stripe email` → **claim atômico** → se
   perder, `signOut()` + `CHECKOUT_ALREADY_CLAIMED`.
3. `finalizeAccountAction` — exige autenticado → revalida a sessão de novo
   → confirma e-mail → **reclama (idempotente/retomada)** → nome (profile)
   → senha (`updateUser`) → `stripe_customers` (upsert por user_id) →
   `checkout_sessions` (**UPDATE**, não upsert, restrito a
   `session_id AND user_id` — nunca sobrescreve outro dono) →
   `syncSubscription`. Entitlement só existe se TODOS os passos anteriores
   passarem — nenhuma etapa libera acesso parcial.
- `linkCheckoutToCurrentUserAction` (conta já existente, login normal):
  mesmo claim atômico + vínculo, sem nome/senha (já existem). Só vincula
  se `user.email === session email`.
- `beginLinkAction` — inalterado (cookie httpOnly → login → volta).

**`/criar-conta`** decide o estado de forma determinística e à prova de
reload (sem inferir nada do React): sessão inválida → erro · logado com
e-mail diferente → bloqueia + oferece sair · `email_has_account` true +
logado → vincular · true + visitante → "já tem conta" (login) · false +
logado → formulário nome/senha · false + visitante → OTP. Como
`email_has_account` só considera senha real, o critério não muda mesmo
depois que o OTP confirma o e-mail — reload no meio do fluxo continua
levando ao passo certo.

**Falhas e retomada:** todo passo de `finalizeAccountAction` após o claim é
idempotente (reclamar de novo = no-op; setar nome/senha de novo = mesmo
resultado; upsert/update restrito = seguro; `syncSubscription` já é
idempotente). Se qualquer passo falhar, a entitlement nunca é criada —
retry seguro chamando a mesma action de novo.

**Webhook:** inalterado (S3 + o skip de `user_not_identified` já feito). ✅

**Config externa:** `success_url` do checkout EXTERNO →
`https://DOMINIO/{locale}/criar-conta?session_id={CHECKOUT_SESSION_ID}`.

⚠️ **Pendências manuais (nada aplicado automaticamente):**
1. Rodar `supabase/APLICAR-STRIPE-S4-CLAIM-MANUAL.sql` no SQL Editor do
   projeto **dev** (`mwpxxxwkvceeobaurgls`) — segue o padrão "aplicação
   manual" do projeto; não apliquei via MCP mesmo estando disponível,
   por preferência já registrada.
2. Configurar o template "Magic Link" no projeto remoto com o conteúdo de
   `supabase/templates/otp.html` (Dashboard ou `supabase config push`).
3. **Não existe projeto Supabase de produção ainda** — quando for criado,
   TODAS as migrations (S1 em diante, incluindo esta) precisam ser
   aplicadas lá também. Não presumir que dev = produção.

**Validado:** tsc/eslint/build OK; rota `/criar-conta` presente; i18n
502/502; 11 testes de lógica de acesso passando; nenhuma referência ao
`createUser` restante no código. E2E clicável (OTP real, claim
concorrente) não roda aqui — preview local serve outro projeto
(`lara-web`) e a RPC ainda não está aplicada no banco.

## CONTEXTO HISTÓRICO — visão original da integração (pré-S2/S3)

> Nota: S2/S3 já foram implementadas (ver seção acima). O texto abaixo é o
> plano original e permanece só como registro. Pendências ainda válidas:
> IA real das 2 ferramentas e páginas de Termos/Privacidade.

Com a UX inteira navegável (e simplificada pelo Bloco 4), o próximo
passo é iniciar a integração real seguindo a "ARQUITETURA DE PAGAMENTO
APROVADA" abaixo: Supabase (auth + schema real substituindo os
`*.mock.ts`) e Stripe (Checkout/webhook/reconciliação). A análise de
prints por IA (as 2 ferramentas) também entra nessa fase — hoje é
setTimeout + sugestões fixas. Antes de começar, as "PENDÊNCIAS DE
DECISÃO" abaixo precisam de resposta do dono — elas bloqueiam decisões
de schema difíceis de desfazer depois. Falta ainda: Checkout/tela de
processamento de pagamento (não construído nem visualmente — dependia
da decisão de preços reais) e páginas de Termos/Privacidade
(referenciadas pelo footer e pelo cadastro desde o Bloco 1/2, ainda
não existem).

## REGRAS DE TRABALHO (aprovadas pelo dono do projeto)

- Todo texto via arquivos de tradução (src/messages) — zero hardcode
- Server Components por padrão; Client só quando necessário
- Arquivos pequenos, componentes reutilizáveis, tipagem completa
- Nunca liberar Premium pelo frontend; nunca expor secrets
- Design: dark, minimalista, premium, um acento só, sem cara de template
- Construir em blocos contínuos, sem pedir aprovação entre telas

## ARQUITETURA DE PAGAMENTO APROVADA (para a fase de integração real)

- Stripe é a fonte da verdade; banco local é espelho
- Evento da Stripe NUNCA é confiável como dado — é sinal de "vá conferir":
  toda sincronização lê o estado atual na API da Stripe
- 4 caminhos PARES (não hierárquicos) convergindo na MESMA função de sync
  idempotente: webhook, reconciliação no retorno do checkout (session_id),
  cron a cada 5min (incl. varredura reversa de subscriptions sem contraparte
  local), reprocessamento manual
- Advisory lock por stripe_subscription_id + descarte de eventos mais
  antigos que o último sincronizado (resolve out-of-order)
- stripe_events com UNIQUE(stripe_event_id); verificar livemode vs ambiente
- Tabelas extras aprovadas: user_entitlements, checkout_sessions,
  subscription_sync_log, refunds, disputes, user_roles, consents,
  usage_quotas, email_log, plan_prices, plan_translations
- Checkout: idempotency key determinística (user+price+janela); metadata
  na session E em subscription_data.metadata; validar session_id contra
  usuário autenticado no retorno
- Tela de processamento: polling 60s máx, depois mensagem honesta
- Critério de aceite central: com webhook desligado, pagamento em test mode
  libera acesso em <5min com trilha de auditoria completa

## PENDÊNCIAS DE DECISÃO (o dono ainda não respondeu)

1. Existem clientes pagantes ativos hoje? (migração vs greenfield)
2. Preços reais dos planos
3. Grace period em past_due (0/3/7 dias)
4. Política de reembolso/disputa sobre o acesso
5. Provedor de IA + teto de gerações por ciclo
6. Trial gratuito: sim ou não

## COMO RODAR

npm install && npm run dev → http://localhost:3000 (redireciona p/ /pt-BR)

## INSTRUÇÃO PARA O NOVO CHAT

"Você é o arquiteto técnico principal da Desenrole.ai. Leia este handoff
e o código do projeto. A fase visual (Blocos 1–3) está concluída — quase
todo o SaaS já é navegável com dados mockados. Antes de tocar em código,
confirme com o dono as PENDÊNCIAS DE DECISÃO listadas abaixo, porque elas
afetam decisões de schema do Supabase difíceis de desfazer depois. Depois
disso, inicie a integração real seguindo EXATAMENTE a ARQUITETURA DE
PAGAMENTO APROVADA e as REGRAS DE TRABALHO. Não refaça o que está pronto."
