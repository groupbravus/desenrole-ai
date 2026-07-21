# ARQUITETURA STRIPE — documento técnico oficial

Define completamente a arquitetura de pagamentos **antes** da
implementação. A implementação deverá seguir exatamente este documento.

- **Escopo:** arquitetura e planejamento. Nenhum código, migration,
  tabela, policy ou arquivo (além deste) foi criado ou alterado.
- **Base:** fundação congelada (`docs/CHECKLIST-PRE-STRIPE.md`). Tudo aqui
  é **aditivo** — não altera nada do que existe.
- **Projeto de dev:** `desenrole-gringa-dev` (ref `mwpxxxwkvceeobaurgls`).
- **Princípio-mãe:** a Stripe é a **fonte da verdade financeira**; o banco
  local é **espelho**. Um evento da Stripe nunca é dado confiável — é
  apenas o sinal "vá conferir o estado atual na API da Stripe".

---

# 0. ESCOPO V1 — CONGELADO (decisões definitivas)

Escopo oficial da V1. A implementação **não** vai além disto sem
aprovação explícita.

| Área | Decisão V1 |
|------|-----------|
| **Plano** | **Exatamente 1 plano.** Mensal. **US$ 9,90/mês**, moeda **USD**, cobrança recorrente mensal. `plans` = 1 linha; `plan_prices` = 1 linha. |
| **Checkout** | **Só Stripe Checkout hospedado.** Sem checkout próprio, sem Stripe Elements, sem Payment Element, **nenhum formulário de cartão na aplicação**. |
| **Fora de escopo** | trial, plano semanal, plano anual, cupons, descontos, promoções, upgrade, downgrade. |
| **Customer Portal** | Portal oficial da Stripe, **apenas** para: cancelar, atualizar cartão, alterar método de pagamento, ver faturas. **Sem troca de plano** (não há para onde trocar). |
| **Acesso Premium** | O retorno do Checkout **nunca** libera acesso. Premium só é concedido por `syncSubscription()` atualizando `entitlements`. A aplicação lê **apenas** `entitlements`. A Stripe **nunca** é consultada em request para decidir acesso. |

Consequências diretas no restante do documento:
- **§5.2** — upgrade/downgrade e trial ficam **fora da V1** (o modelo os
  suporta, mas não são implementados).
- **§6** — `source = 'trial'` não é usado na V1; entitlement deriva só de
  `subscription` (+ grace, quando decidido) e `manual` (cortesia admin).
- **§8/§9** — Checkout 100% hospedado; Portal sem troca de plano.
- **§13** — decisões **D2, D5, D7, D10 resolvidas**; permanecem abertas
  **D1, D3, D4, D9** (e confirmar D8). Ver §13.

---

# 1. Objetivo

Descrever toda a arquitetura Stripe: modelagem, ciclo de vida do Customer
e da Subscription, entitlements desacoplados, webhooks idempotentes,
checkout, portal, segurança, recuperação, testes e o plano de
implementação faseado.

A regra central de aceite (herdada da arquitetura aprovada): **com o
webhook desligado, um pagamento em test mode deve liberar o acesso em
menos de 5 minutos, com trilha de auditoria completa** — provado pelos
caminhos de reconciliação.

---

# 2. Requisitos

O sistema usará:

- **Stripe Checkout** (hospedado) — coleta de pagamento.
- **Stripe Billing** — assinatura recorrente mensal (V1: plano único).
- **Customer Portal** — o próprio usuário gerencia/cancela/atualiza.
- **Webhooks** — sinal de mudança de estado.
- **Assinaturas recorrentes**.

Invariantes de separação (não-negociáveis):

- **Autenticação continua 100% Supabase.** A Stripe **nunca** autentica.
- **A assinatura nunca substitui identidade.** `profiles` permanece
  só-identidade; nada de Stripe entra lá (exceto, opcionalmente, o
  `stripe_customer_id` como ponteiro — ver §4 e Decisão D8).
- **Acesso Premium é derivado, calculado no servidor** (§6), nunca um
  booleano vindo do cliente, nunca lido de `profiles`.
- **Toda lógica financeira roda no servidor.** O navegador nunca vê
  secret nem decide acesso.

---

# 3. Modelagem

Todas as tabelas são **novas e aditivas**, no schema `public`, com RLS
deny-by-default. Padrão de escrita: **o cliente nunca escreve** em tabela
financeira — só `service_role` (webhook/sync) ou funções `SECURITY
DEFINER`. O cliente pode, no máximo, **ler as próprias** linhas de
`subscriptions` e `entitlements`.

> Observação: esta seção descreve finalidade, relacionamentos, índices,
> chaves e ciclo de vida. **Nenhum SQL/DDL** — isso é da fase de
> implementação.

## 3.1 `stripe_customers`

- **Finalidade:** mapear 1:1 `auth.users` ↔ Stripe Customer.
- **Chaves:** PK `user_id` (→ `auth.users.id`); `stripe_customer_id`
  único.
- **Relacionamento:** 1:1 com usuário. Um usuário = um Customer.
- **Índices:** único em `stripe_customer_id` (lookup no webhook).
- **Ciclo de vida:** criado na primeira intenção de checkout (ou primeiro
  acesso ao portal); nunca apagado enquanto o usuário existir; `on delete
  cascade` do usuário.
- **Alternativa (Decisão D8):** virar coluna `stripe_customer_id` em
  `profiles`. Recomendação: **tabela separada**, para manter `profiles`
  estritamente identidade e isolar o domínio financeiro.

## 3.2 `plans`

- **Finalidade:** catálogo comercial estável (o "produto" no nosso
  vocabulário). **V1: exatamente 1 plano** (`premium`, mensal). Independe
  de preço. O modelo suporta N planos para a V2.
- **Chaves:** PK `id` (slug estável, ex. `premium`); campos: nome-chave
  i18n, featureKeys, `active`, `sort_order`.
- **Relacionamento:** 1:N com `plan_prices`.
- **Ciclo de vida:** semeado por migration/seed; raramente muda. Fonte da
  verdade **comercial** (o que o produto oferece), distinta da fonte de
  **preço** (Stripe).

## 3.3 `plan_prices`

- **Finalidade:** **espelho** dos Stripe Prices. Desacopla "quanto custa"
  (Stripe) de "o que é" (`plans`).
- **Chaves:** PK própria; `stripe_price_id` único; FK → `plans.id`.
- **Campos:** `unit_amount`, `currency`, `interval` (week/month),
  `active`, `stripe_product_id`.
- **Relacionamento:** N:1 com `plans`.
- **Índices:** único `stripe_price_id`; índice por `plan_id`.
- **Ciclo de vida:** sincronizado da Stripe (idealmente por evento
  `price.*`/`product.*` ou por sync manual/seed). A UI de pricing lê
  **daqui**, nunca de valor hardcoded.

## 3.4 `subscriptions`

- **Finalidade:** **espelho** da Stripe Subscription (não a fonte da
  verdade — a Stripe é).
- **Chaves:** PK `stripe_subscription_id`; FK `user_id` → `auth.users`.
- **Campos:** `status` (enum espelhando a Stripe), `stripe_customer_id`,
  `stripe_price_id`, `current_period_start`, `current_period_end`,
  `cancel_at_period_end`, `canceled_at`, `trial_end`,
  `latest_event_at` (para descarte out-of-order — ver §7),
  `updated_at`.
- **Relacionamento:** N:1 com usuário (normalmente 1 ativa; o modelo
  suporta histórico).
- **Índices:** `user_id`; `status`; `stripe_customer_id`.
- **Ciclo de vida:** criada/atualizada **apenas** por `syncSubscription`
  (§5, §7). Nunca escrita pelo cliente.

## 3.5 `entitlements`

- **Finalidade:** **direitos de acesso derivados** — a camada que a
  aplicação consulta para decidir Premium. **Desacoplada da Stripe** (§6).
- **Chaves:** PK própria; FK `user_id`; `feature` (ex. `premium`).
- **Campos:** `granted_until` (timestamp; acesso válido enquanto
  `now() < granted_until`), `source` (`subscription`/`manual`/`trial`),
  `source_ref` (ex. `stripe_subscription_id`), `updated_at`.
- **Relacionamento:** N por usuário (uma linha por feature).
- **Índices:** único `(user_id, feature)`; índice por `granted_until`
  (varreduras de expiração).
- **Ciclo de vida:** **recalculado** por `syncSubscription` a cada
  sincronização; a fonte é sempre o estado espelhado + regras (grace
  period, trial). Nunca escrito pelo cliente.

## 3.6 `checkout_sessions`

- **Finalidade:** rastrear cada Checkout Session criada, para reconciliar
  no retorno e auditar.
- **Chaves:** PK própria; `stripe_checkout_session_id` único; FK
  `user_id`.
- **Campos:** `stripe_price_id`, `status` (`open`/`complete`/`expired`),
  `stripe_subscription_id` (preenchido quando conhecido), `created_at`.
- **Ciclo de vida:** criada na geração do checkout; atualizada no retorno
  e/ou por webhook `checkout.session.completed`.

## 3.7 `webhook_events`

- **Finalidade:** **idempotência e trilha** dos eventos recebidos.
- **Chaves:** PK própria; `stripe_event_id` **único** (dedup).
- **Campos:** `type`, `livemode`, `payload` (jsonb, para auditoria/replay),
  `received_at`, `processed_at`, `process_status`
  (`received`/`processed`/`skipped`/`error`), `error` (texto).
- **Ciclo de vida:** inserido no recebimento; marcado processado/skip/erro
  ao fim. Retido para auditoria e reprocessamento.

## 3.8 `subscription_sync_log`

- **Finalidade:** **auditoria** de toda execução de `syncSubscription`:
  quem disparou, estado antes/depois, evento associado.
- **Campos:** `stripe_subscription_id`, `source`
  (`webhook`/`checkout_return`/`cron`/`admin`), `event_id` (quando houver),
  `status_before`, `status_after`, `entitlement_before`,
  `entitlement_after`, `created_at`.
- **Ciclo de vida:** append-only; base para "por que este usuário tem/não
  tem acesso agora".

## 3.9 (Opcional / fase de IA) `usage_quotas` e `usage_events`

- **Finalidade:** teto de gerações da IA por ciclo. **Fora do escopo
  imediato do Stripe**; só entra quando a IA e o teto forem decididos
  (Decisão D6). Mencionadas para o modelo já prever o encaixe:
  `entitlements` responde "tem acesso?", `usage_quotas` responde "ainda
  tem saldo no ciclo?".

## 3.10 Relacionamento geral

```
auth.users ─1:1─ stripe_customers ─1:N─ subscriptions ─derivam→ entitlements
     │                                        ▲
     └─1:N─ checkout_sessions ────────────────┘ (referência)

plans ─1:N─ plan_prices          webhook_events   subscription_sync_log
(catálogo) (espelho de preço)    (idempotência)   (auditoria)
```

---

# 4. Customer

- **Como será criado:** via API da Stripe (`customers.create`) a partir do
  servidor, com `metadata.user_id` = id do Supabase (ponte para o
  webhook).
- **Quando:** **lazy** — na primeira vez que o usuário inicia um checkout
  (ou abre o portal), se ainda não houver `stripe_customers`. Não se cria
  Customer no cadastro (evita Customers órfãos de quem nunca pagou).
- **Quem cria:** uma Server Action / função de servidor autenticada
  (`getOrCreateStripeCustomer`), nunca o cliente.
- **Como sincronizar:** o `stripe_customer_id` volta e é gravado em
  `stripe_customers`. O e-mail do Customer espelha o do usuário; se o
  e-mail mudar no Supabase, atualiza-se o Customer (opcional, não crítico).
- **Duplicidade — prevenção em três camadas:**
  1. Checagem "existe em `stripe_customers`?" antes de criar.
  2. `stripe_customer_id` **único** no banco.
  3. **Idempotency-Key** na chamada `customers.create` (determinística por
     `user_id`), para que um duplo clique/retry não gere dois Customers.
- **Duplicidade — cura:** se, por corrida, existirem dois Customers para o
  mesmo `user_id` na Stripe, a reconciliação escolhe o que tem assinatura
  ativa (ou o mais recente) como canônico; o outro é marcado/ignorado. A
  varredura reversa do cron (§7) detecta o caso.

---

# 5. Subscription

## 5.1 Estados (espelhando a Stripe)

`trialing`, `active`, `past_due`, `canceled`, `incomplete`,
`incomplete_expired`, `unpaid`, `paused`. O banco guarda o valor cru da
Stripe; a **regra de acesso** (§6) traduz isso em entitlement.

## 5.2 Lifecycle

- **Criação:** o Checkout gera a Subscription na Stripe →
  `syncSubscription` cria o espelho + entitlement.
- **Renovação:** ocorre na Stripe; chega como
  `invoice.paid`/`customer.subscription.updated` → sync relê e estende
  `current_period_end` → recalcula `granted_until`. **Nunca somamos dias
  manualmente** — definimos o estado absoluto vindo da Stripe.
- **Cancelamento:**
  - *No fim do período* (`cancel_at_period_end = true`): acesso continua
    até `current_period_end`; entitlement expira naturalmente ali.
  - *Imediato*: status vira `canceled`; entitlement revogado na próxima
    sincronização (respeitando política de reembolso — Decisão D4).
- **Expiração:** quando `now() > granted_until`, o usuário perde Premium
  sem precisar de evento — o cálculo é por tempo. O cron (§7) e a leitura
  em tempo real cobrem isso.
- **Grace period (Decisão D3 — em aberto):** em `past_due`, `granted_until`
  pode ser estendido por 0/3/7 dias além de `current_period_end`, dando
  margem para a cobrança se resolver antes de cortar o acesso.
- **Upgrade/Downgrade:** ~~fora da V1~~ (só 1 plano; não há troca). O
  modelo suporta caso a V2 traga mais planos, mas **não é implementado**.

---

# 6. Entitlements (acesso desacoplado da Stripe)

**Como o sistema decide Premium:** uma única função de servidor
`hasEntitlement(userId, feature)` que consulta **apenas** a tabela
`entitlements`:

```
premium ativo  ⇔  existe entitlement (user, 'premium') com granted_until > now()
```

- **Desacoplamento:** a aplicação **nunca** chama a Stripe para decidir
  acesso em tempo de request. Ela lê `entitlements`, que é um estado local
  derivado. Isso torna o acesso rápido, resiliente a indisponibilidade da
  Stripe, e testável isoladamente.
- **Quem escreve `entitlements`:** só `syncSubscription` (e concessões
  manuais de admin). O cliente só lê a própria linha (RLS).
- **Derivação:** `syncSubscription` calcula `granted_until` a partir de:
  status da subscription + `current_period_end` + `trial_end` + grace
  period. Regra viva num só lugar, não espalhada.
- **Fontes múltiplas:** `source` distingue `subscription`, `trial` e
  `manual` (ex. cortesia concedida pelo admin) — permite acesso sem Stripe
  quando fizer sentido, sem furar o modelo.
- **Vantagem para a fase de IA:** `entitlements` responde "tem acesso?" e,
  no futuro, `usage_quotas` responde "tem saldo?". Gate do workspace de
  análise: `requireUser` → `hasEntitlement('premium')` → (futuro)
  quota → chama IA.

---

# 7. Webhooks

## 7.1 Eventos necessários (mínimo)

| Evento | Uso |
|--------|-----|
| `checkout.session.completed` | Confirma que o checkout fechou; dispara sync |
| `customer.subscription.created` | Nova assinatura |
| `customer.subscription.updated` | Renovação, `cancel_at_period_end`, `past_due` (V1 não tem upgrade/downgrade) |
| `customer.subscription.deleted` | Assinatura encerrada |
| `invoice.paid` | Renovação confirmada (estende período) |
| `invoice.payment_failed` | Entra em past_due (grace period) |
| `charge.refunded` | Reembolso (Decisão D4 sobre acesso) |
| `charge.dispute.created` | Disputa/chargeback (Decisão D4) |
| `price.updated` / `product.updated` (opcional) | Manter `plan_prices` em dia |

**Regra de ouro:** o handler **não confia no payload** como dado. Ele
extrai apenas o **id** (subscription/customer) e chama `syncSubscription`,
que **relê o estado atual na API da Stripe**.

## 7.2 Fluxo completo do handler

1. Ler o **raw body** e o header `Stripe-Signature`.
2. **Verificar a assinatura** com `STRIPE_WEBHOOK_SECRET` → rejeita se
   inválida (§10).
3. **Verificar `livemode`** vs ambiente (dev só aceita `livemode=false`) →
   descarta se divergir.
4. **Dedup:** tentar inserir em `webhook_events` por `stripe_event_id`
   único. Se já existe → responder 200 e **parar** (idempotência).
5. Resolver o `stripe_subscription_id` do evento → chamar
   `syncSubscription`.
6. Marcar `webhook_events.processed_at`/status. Responder **200 rápido**;
   trabalho pesado é idempotente e reexecutável.

## 7.3 `syncSubscription` — a função central idempotente

Chamada por **4 caminhos pares** (webhook, retorno do checkout, cron,
reprocessamento admin), **sem ordem entre si** — quem chegar primeiro
sincroniza, os demais convergem para o mesmo estado.

1. **Advisory lock** por `stripe_subscription_id`
   (`pg_advisory_xact_lock(hashtext(id))`) — serializa syncs concorrentes
   do mesmo assinante.
2. **Relê o estado atual** na API da Stripe (`subscriptions.retrieve`).
3. **Descarte out-of-order:** compara o timestamp do evento/estado com
   `subscriptions.latest_event_at`; se for **mais antigo** que o último
   sincronizado, **ignora** (evita regressão por evento atrasado).
4. Escreve o **espelho** em `subscriptions` (estado absoluto da Stripe).
5. **Recalcula `entitlements`** (`granted_until` a partir do estado +
   grace/trial).
6. Grava `subscription_sync_log` (antes/depois/source/event_id).
7. Tudo numa transação; idempotente: reexecutar com o mesmo estado produz
   o mesmo resultado, **sem duplicar período nem somar dias**.

## 7.4 Idempotência, retries, ordem, duplicidade

- **Idempotência:** garantida por (a) dedup de `webhook_events`, (b)
  releitura de estado absoluto, (c) advisory lock.
- **Retries da Stripe:** o mesmo evento pode chegar N vezes → dedup barra;
  se o processamento falhar, respondemos não-2xx e a Stripe re-tenta.
- **Ordem / fora de ordem:** resolvido pelo passo 3 (descarte de eventos
  mais antigos que o último sincronizado).
- **Duplicidade:** `stripe_event_id` único + `stripe_subscription_id`
  como chave do espelho.

## 7.5 Reconciliação (os outros 3 caminhos)

- **Retorno do checkout:** valida `session_id` do usuário autenticado →
  resolve a subscription → `syncSubscription`. Cobre o caso "webhook
  atrasou".
- **Cron (~5 min):** varre subscriptions locais não-terminais **e** faz
  **varredura reversa** (subscriptions na Stripe sem contraparte local, ou
  Customers sem subscription espelhada) → `syncSubscription`. É o que
  garante o critério "<5min com webhook desligado".
- **Reprocessamento admin:** botão no painel → `syncSubscription` sob
  demanda (com log obrigatório — §10).

---

# 8. Checkout

- **Origem:** o usuário autenticado clica em "assinar" (na aba Assinatura
  das Configurações, ou na landing/pricing → após login). Uma Server
  Action:
  1. `requireUser`;
  2. `getOrCreateStripeCustomer`;
  3. cria a **Checkout Session** (`mode: subscription`) com:
     - `customer` = o do usuário;
     - `line_items` = o `stripe_price_id` escolhido (lido de
       `plan_prices`);
     - **Idempotency-Key determinística** (`user + price + janela de
       tempo`) para duplo clique não criar duas sessões;
     - `metadata.user_id` **e** `subscription_data.metadata.user_id`
       (ponte redundante para o webhook);
     - `success_url` → `/{locale}/checkout/processando?session_id=...`;
     - `cancel_url` → `/{locale}/checkout/cancelado`;
  4. registra em `checkout_sessions`;
  5. redireciona para a URL hospedada da Stripe.
- **Retorno (sucesso):** a página **Processando** valida o `session_id`
  contra o usuário autenticado, dispara a reconciliação e faz **polling do
  entitlement por ≤ 60s**; ao virar Premium → tela de sucesso; se estourar
  o tempo → **mensagem honesta** ("pagamento recebido, liberação em
  instantes / avisaremos por e-mail"), nunca liberando acesso pela UI.
- **Cancelamento:** `cancel_url` → tela neutra "checkout cancelado, nada
  foi cobrado", com CTA de voltar.
- **Falhas:** pagamento recusado fica na própria Stripe (não cria
  subscription ativa); se criar `incomplete`, o entitlement não é
  concedido. Erros de criação da sessão → mensagem de erro traduzida, sem
  vazar detalhe técnico.
- **Regra inviolável:** **voltar do checkout NÃO libera Premium.** A
  liberação vem exclusivamente de `syncSubscription` lendo a Stripe.

---

# 9. Customer Portal

- **Fluxo:** Server Action `requireUser` → cria uma **Billing Portal
  Session** (`billingPortal.sessions.create`) para o Customer do usuário →
  redireciona. No portal (V1), o usuário: **cancela**, **atualiza cartão/
  método de pagamento** e **vê faturas**. **Troca de plano desabilitada**
  na configuração do portal (não há outro plano).
- **Configuração do portal (Stripe Dashboard):** habilitar cancelamento,
  método de pagamento e histórico de faturas; **desabilitar** "update
  subscription / switch plan" e quantidade.
- **Retorno:** `return_url` → `/{locale}/configuracoes` (aba Assinatura).
- **Sincronização:** qualquer mudança feita no portal chega por **webhook**
  (`customer.subscription.updated`/`deleted`) e/ou é capturada pelo **cron**
  — em ambos os casos via `syncSubscription`. O retorno do portal também
  pode disparar uma reconciliação imediata para refletir na hora.

---

# 10. Segurança

- **Validação de assinatura do webhook:** obrigatória, com
  `STRIPE_WEBHOOK_SECRET`, sobre o **raw body** (nunca o parseado).
  Assinatura inválida → 400, sem processar.
- **Replay attacks:** a verificação da Stripe já inclui timestamp com
  tolerância; além disso, `webhook_events.stripe_event_id` único impede
  reprocessar um evento repetido.
- **Validação de `livemode`:** evento com `livemode` divergente do
  ambiente é descartado — impede eventos de produção afetarem dev e
  vice-versa.
- **Segredos:** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` **só no
  servidor**, nunca `NEXT_PUBLIC_*`. Só a **publishable key** é pública.
  Rotação documentada.
- **Autorização financeira:** todas as tabelas financeiras **não
  graváveis** por `authenticated` (só `service_role`/DEFINER) — o RLS é o
  backstop, no mesmo modelo já usado em `user_roles`.
- **Logs:** nunca logar secret, token, número de cartão nem PII sensível.
  Logar ids da Stripe (event/subscription/customer) e transições de
  estado.
- **Auditoria:** `subscription_sync_log` (toda sincronização) +
  `webhook_events` (todo evento) + log obrigatório do reprocessamento
  admin. Responde sempre "por que este usuário tem/não tem acesso".
- **Superfície do webhook:** a rota `/api/webhooks/stripe` fica **fora** do
  matcher de auth do middleware (é chamada pela Stripe, não por usuário);
  sua única autorização é a assinatura.

---

# 11. Recuperação

- **Detectar divergências:** o **cron de reconciliação** compara o espelho
  local com a Stripe (nos dois sentidos: local→Stripe e Stripe→local via
  varredura reversa) e registra/corrige diferenças.
- **Sincronizar novamente:** qualquer inconsistência é resolvida chamando
  `syncSubscription` (mesma função idempotente) — não há caminho de
  "conserto manual" que fuja dela.
- **Ferramentas de recuperação:**
  - **Reprocessamento admin** por `stripe_subscription_id` (botão no
    painel, com log).
  - **Replay** de um `webhook_events` guardado (o payload fica salvo).
  - **Concessão/revogação manual** de entitlement pelo admin (source
    `manual`), auditada, para casos excepcionais.
- **Critério de recuperação:** após qualquer incidente, rodar o cron uma
  vez deve trazer todos os entitlements ao estado correto derivado da
  Stripe.

---

# 12. Testes

## Fluxos felizes
- Checkout → subscription `active` → entitlement concedido → acesso
  Premium liberado.
- Renovação (`invoice.paid`) estende `granted_until`.
- Upgrade/downgrade reflete novo `plan_price`.

## Fluxos negativos
- Pagamento recusado → subscription não ativa → **sem** entitlement.
- `invoice.payment_failed` → `past_due` → acesso mantido só durante o grace
  period → cortado depois.
- Cancelamento no fim do período → acesso até `current_period_end`.
- Cancelamento imediato → acesso revogado conforme política.

## Idempotência / robustez
- **Sync 2× / evento repetido** = mesmo estado, **sem período duplicado**.
- **Out-of-order:** evento antigo após novo → **sem regressão**.
- **Webhook:** assinatura inválida rejeitada; `livemode` divergente
  rejeitado; `stripe_event_id` duplicado ignorado.
- **Duplicidade de Customer:** duplo checkout não cria dois Customers.

## Reembolso / disputa
- `charge.refunded` → acesso ajustado conforme política (Decisão D4).
- `charge.dispute.created` → comportamento conforme política.

## RLS / segurança
- Usuário A não lê subscription/entitlement de B.
- `authenticated` não escreve em nenhuma tabela financeira.

## Critério de aceite central
- **Webhook desligado + pagamento test mode → acesso em < 5 min** via
  reconciliação, com trilha completa em `subscription_sync_log`.

Ferramentas: Stripe **test mode** + **Stripe CLI** (`stripe listen`,
`stripe trigger`) para simular eventos; cartões de teste para recusa,
sucesso, `past_due`.

---

# 13. Decisões em aberto (dependem do proprietário)

## Resolvidas (congeladas na V1)

| ID | Decisão | Valor definitivo |
|----|---------|------------------|
| D2 | Preço | **1 plano, mensal, US$ 9,90/mês, USD** |
| D5 | Trial | **Não** |
| D7 | Upgrade/downgrade | **Não** (1 plano) |
| D10 | Escopo do Portal | Cancelar + método de pagamento + faturas; **sem troca de plano** |

## Ainda abertas — necessárias antes/na implementação

| ID | Decisão | Impacto | Quando trava |
|----|---------|---------|--------------|
| **D1** | **Clientes pagantes hoje?** (migração vs greenfield) | Importar subscriptions existentes ou não | Antes da S0 |
| **D3** | **Grace period** em `past_due`: 0 / 3 / 7 dias | Fórmula de `granted_until` | Antes da S2 (núcleo de sync) |
| **D4** | **Reembolso/disputa** sobre o acesso: corta na hora? mantém até o fim do período? | Comportamento em `charge.refunded`/`dispute` | Antes da S5 |
| **D8** | **`stripe_customer_id`**: tabela `stripe_customers` (recomendado) ou coluna em `profiles`? | Modelagem §3.1 | Antes da S0 |
| **D9** | **Cron:** Supabase Edge Function agendada, cron externo, ou Vercel Cron? | Infra da reconciliação | Antes da S4 |
| D6 | Provedor de IA + teto de gerações | `usage_quotas` (fase de IA) — **não bloqueia** o Stripe | Fase de IA |

---

# 14. Plano de implementação (fases pequenas, independentes, validáveis)

Cada fase termina **funcionando e testável** antes da próxima. Pré-fase:
resolver **R2** (acesso admin ao Supabase — MCP/CLI) e as decisões D1–D5,
D8.

### Fase S0 — Fundação Stripe (sem cobrança real)
- Conta/keys de test mode; env vars no servidor; SDK Stripe no servidor.
- Migrations das tabelas §3 (RLS deny-by-default, grants só service_role).
- Seed de `plans` + `plan_prices` (espelho dos Prices de teste).
- **Aceite:** tabelas criadas, RLS testada (cliente não lê/escreve
  indevido), pricing da UI lendo de `plan_prices`.

### Fase S1 — Customer + Checkout (liberação ainda manual)
- `getOrCreateStripeCustomer` (idempotente, anti-duplicidade).
- Server Action de checkout + `checkout_sessions` + páginas
  `processando`/`cancelado`.
- **Sem** liberação automática ainda (o entitlement é concedido à mão para
  validar a UI).
- **Aceite:** usuário chega ao Checkout hospedado, volta para
  "Processando", `session_id` validado; Customer único garantido.

### Fase S2 — Núcleo de sincronização
- `syncSubscription` idempotente (advisory lock + releitura + out-of-order
  + `subscriptions` + `entitlements` + `subscription_sync_log`).
- `hasEntitlement` + gate real de Premium no app.
- Reconciliação no **retorno do checkout**.
- **Aceite:** pagamento em test mode → retorno reconcilia → acesso em
  <5min; sync 2× = mesmo estado.

### Fase S3 — Webhook
- Rota `/api/webhooks/stripe`: assinatura + livemode + dedup
  (`webhook_events`) → `syncSubscription`.
- **Aceite:** `stripe trigger` de todos os eventos §7.1 → estado correto;
  assinatura inválida/livemode divergente/evento duplicado rejeitados.

### Fase S4 — Reconciliação contínua + admin
- **Cron** (Decisão D9) com varredura direta e reversa.
- **Reprocessamento admin** + replay de `webhook_events` (com log).
- **Aceite central:** **webhook desligado** → pagamento test mode libera
  em <5min via cron, trilha completa.

### Fase S5 — Customer Portal + lifecycle completo
- Portal (upgrade/downgrade/cancel — Decisão D10) + `return_url` +
  reconciliação no retorno.
- Grace period (D3), reembolso/disputa (D4), trial (D5) exercitados.
- **Aceite:** todos os fluxos negativos de §12 passam.

### Fase S6 — Homologação e endurecimento
- Bateria completa de §12 em test mode.
- **Absorve a validação de runtime de auth adiada** (R1) com contas reais.
- Rate limiting, revisão de segredos/logs, `npm audit`.
- **Aceite:** checklist de §12 verde; auditoria de segurança da fase paga.

> Regra: só passar de S(n) para S(n+1) com o **aceite** de S(n) cumprido.

---

# Observação final

Este documento é a especificação a ser seguida na implementação. **Nada
foi implementado.** Antes de escrever a primeira linha da Fase S0,
faremos a revisão conjunta deste documento e o preenchimento das decisões
D1–D10.
