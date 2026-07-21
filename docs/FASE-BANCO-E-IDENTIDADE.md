# FASE — Banco de Dados & Identidade

Supabase real, autenticação, RBAC, RLS e substituição dos mocks de
usuário. **Stripe não foi implementado** (fase seguinte, aguardando
autorização).

> **Status: quase completa.** Estrutura, código e endurecimentos de
> segurança (D1, D2, E1) prontos e aplicados. Falta **um único bloco de
> validação de runtime que depende de e-mails reais** (não fornecidos
> ainda): confirmação/recuperação de e-mail, cookie httpOnly observado em
> tráfego real, troca de senha ponta a ponta e isolamento A×B em runtime.
> Ver "Endurecimentos de segurança" e "Pendências". Não avançar para
> Stripe antes disso.

## Endurecimentos de segurança (auditoria pré-Stripe)

Detalhe completo em `docs/AUDITORIA-SEGURANCA-PRE-STRIPE.md`.

- **Corrigido — open redirect no `?next=` do login** (severidade alta):
  o valor da URL ia direto ao `router.replace()`. Novo
  `safeInternalPath()` bloqueia esquema absoluto, `//`, `\` e `..`.
- **D1 — troca segura de senha:** dois fluxos separados.
  `changePasswordAction` (configurações) exige a senha atual, validada
  num client Supabase isolado; `resetPasswordAction` (pós link) não
  exige. Ambos rodam `signOut({scope:"others"})`.
  `secure_password_change = true` no config.
- **D2 — cookie de sessão httpOnly:** confirmado no SDK que
  `cookieOptions` sobrescreve os defaults; browser client removido.
  Sessão `httpOnly` + `secure` (prod) + `sameSite=lax` + `path=/`.
- **E1 — `analysis_history` somente leitura:** INSERT/UPDATE/DELETE
  revogados do cliente (dupla barreira). ✅ **Aplicada e verificada no
  SQL Editor** pelo proprietário (grants para `authenticated` = só
  `SELECT`). Migration versionada em
  `20260720130000_analysis_history_readonly.sql`.

---

## Ambientes

| Ambiente | Projeto | Status |
|----------|---------|--------|
| local | `supabase start` (Docker) | Config pronta, **não executável nesta máquina** — Docker ausente |
| development | `desenrole-gringa-dev` · ref `mwpxxxwkvceeobaurgls` · us-east-1 | **Ativo**, migrations aplicadas |
| production | — | Criar apenas no lançamento, projeto separado |

O projeto antigo (com clientes reais) **não foi tocado em nenhum momento**.
Nenhuma migration, query ou alteração foi aplicada fora do projeto novo.

**Custo:** US$ 10/mês recorrente pelo projeto de development (aprovado).

---

## Como rodar

```bash
# 1. Dependências
npm install

# 2. Variáveis (já criado neste repo; recriar a partir do exemplo se preciso)
cp .env.example .env.local   # e preencher URL + anon key

# 3. App
npm run dev                  # http://localhost:3000
```

### Supabase local (quando houver Docker)

```bash
npx supabase start           # sobe Postgres + Auth + Studio
npx supabase db reset        # aplica TODAS as migrations do zero + valida
npx supabase stop
```

> ⚠️ Docker não está instalado nesta máquina, então o stack local nunca
> foi executado. As migrations foram validadas aplicando-as no projeto
> remoto de development. Instalar o Docker Desktop e rodar
> `npx supabase db reset` é a forma de confirmar que a sequência aplica
> limpa do zero.

### Aplicar migrations no projeto remoto

```bash
npx supabase link --project-ref mwpxxxwkvceeobaurgls
npx supabase db push          # aplica apenas o que falta
npx supabase migration list   # compara local x remoto
```

**Regra:** nenhuma alteração manual no banco remoto sem migration
correspondente versionada em `supabase/migrations/`.

---

## Variáveis de ambiente

| Variável | Obrigatória | Observação |
|----------|-------------|------------|
| `NEXT_PUBLIC_APP_URL` | sim | Monta os links dos e-mails |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave anônima; proteção real é o RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **não** | Deliberadamente fora da app (ver abaixo) |

### Por que não há service role key na aplicação

A leitura administrativa usa funções `SECURITY DEFINER` no banco
(`admin_list_users`, `admin_get_user`, `admin_stats`) que checam
`is_admin()` **internamente**. Um não-admin recebe zero linhas.

Isso elimina a necessidade de carregar uma chave que ignora RLS por
completo dentro da aplicação. A service role só voltará a ser necessária
na fase Stripe (webhook/sincronização), e mesmo assim restrita ao
servidor.

---

## Banco de dados

### Tabelas

| Tabela | Conteúdo |
|--------|----------|
| `profiles` | Identidade: name, avatar_url, locale, timezone, timestamps |
| `user_roles` | RBAC (`user`/`admin`), PK composta (user_id, role) |
| `quiz_results` | Resultado final: profile, scores, version, completed_at + `client_result_id` (idempotência) |
| `analysis_history` | Preparada para a IA: tool, status, input_ref, result |
| `support_requests` | subject, message, status; `user_id` nullable (ON DELETE SET NULL) |

`profiles` **não** contém plano, assinatura, premium, Stripe ID, quotas
nem papel — conforme especificado.

### Funções

| Função | Papel |
|--------|-------|
| `handle_new_user()` | Trigger de signup: cria profile + concede **apenas** `user` |
| `set_updated_at()` | Trigger de `updated_at` |
| `has_role(uuid, app_role)` | SECURITY DEFINER; **não exposta** na API |
| `is_admin()` | SECURITY DEFINER; executável por `authenticated` (as policies precisam) |
| `admin_list_users()` / `admin_get_user()` / `admin_stats()` | Leitura administrativa com `is_admin()` embutido |

### Migrations aplicadas

```
20260720120000_identity.sql              profiles, user_roles, helpers, trigger, RLS
20260720120100_quiz_results.sql          quiz_results + idempotência + RLS
20260720120200_analysis_history.sql      analysis_history + RLS
20260720120300_support_requests.sql      support_requests + RLS
20260720120400_harden_functions.sql      correções do database linter
20260720120500_admin_read_functions.sql  leitura admin sem service role
```

---

## Segurança

- **RLS ativo em todas as tabelas**, deny-by-default.
- `anon` **não tem grant algum** — é barrado antes mesmo do RLS.
- `user_roles` não tem policy de escrita para `authenticated`, e o grant
  de INSERT/UPDATE/DELETE também foi negado. Dupla barreira contra
  auto-promoção a admin.
- Toda validação das Server Actions é refeita no servidor com Zod.
- Proteção contra open redirect no `?next=`.
- Nenhum token sensível trafega em query string após o callback.

### Aviso aceito conscientemente

O linter do Supabase sinaliza `is_admin()` como executável por
`authenticated`. **É intencional e necessário:** o Postgres exige
`EXECUTE` na função usada dentro de uma policy de RLS, avaliada no
contexto de quem consulta. Revogar quebraria todas as policies. A função
só revela ao próprio chamador se ele é admin. Todos os demais avisos
foram corrigidos na migration `harden_functions`.

---

## Como criar o primeiro administrador

Não existe caminho pela interface — de propósito. Todo cadastro recebe
somente o papel `user`.

1. Crie sua conta normalmente pelo `/cadastro`.
2. No **SQL Editor** do projeto Supabase, execute:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'SEU-EMAIL@dominio.com'
on conflict (user_id, role) do nothing;
```

3. Faça logout e login novamente. `/admin` passa a responder.

Para revogar: `delete from public.user_roles where user_id = '<id>' and role = 'admin';`

---

## Configuração manual no painel do Supabase

Itens que **não** são versionáveis por migration:

1. **URL Configuration → Site URL:** `http://localhost:3000` em dev; o
   domínio real em produção.
2. **URL Configuration → Redirect URLs:** adicionar um por idioma:
   `http://localhost:3000/pt-BR/auth/callback` (e `en`, `es`, `fr`, `it`,
   `de`). Sem isso, os links de e-mail não voltam para a aplicação.
3. **Authentication → Email templates:** colar o conteúdo de
   `supabase/templates/{confirmation,recovery,email-change}.html`
   (identidade da marca, já prontos). No local eles já são aplicados via
   `config.toml`.
4. **Authentication → Providers → Email:** decidir se "Confirm email"
   fica ligado em dev (ver pendência abaixo).
5. **Authentication → Providers → Email → "Secure password change":**
   ligar (D1). A aplicação também exige a senha atual — defesa em
   profundidade.
6. **SMTP próprio:** obrigatório antes de produção. O serviço nativo tem
   limite baixo de envio e restrição de destinatários.
7. **E1 já aplicado** via `supabase/APLICAR-E1-MANUAL.sql` (SQL Editor).
   Guardar como referência caso o projeto de produção precise da mesma
   configuração.

---

## O que foi validado

| Item | Status | Como |
|------|--------|------|
| Migrations aplicam sem erro | ✅ | 6 migrations no projeto dev |
| Trigger cria profile + papel `user` | ✅ | 3 usuários; nenhum admin automático |
| Login | ✅ | UI + API, sessão estabelecida |
| Logout | ✅ | Sessão limpa, redirect para a landing |
| Persistência de sessão após reload | ✅ | Cookie sobrevive ao reload |
| Visitante em rota protegida | ✅ | 307 → `/login?next=/pt-BR/painel` |
| Retorno à página originalmente pedida | ✅ | Login em `/admin` levou de volta a `/admin` |
| Usuário comum na área admin | ✅ | **404** |
| Acesso do administrador | ✅ | Painel com dados reais |
| RLS — anônimo | ✅ | Bloqueado nas 5 tabelas (nível de grant) |
| RLS — isolamento A × B | ✅ | Nenhum vazamento nos dois sentidos |
| RLS — auto-promoção a admin | ✅ | INSERT/UPDATE/DELETE negados |
| RLS — admin lê tudo | ✅ | 3 profiles, funções administrativas OK |
| `has_role` não sondável | ✅ | Negado a usuário comum |
| Escrita cruzada | ✅ | Inserts negados; update afetou 0 linhas |
| Idempotência do quiz | ✅ | 3 reivindicações, mesma chave = 1 linha |
| Suporte: criar e ler o próprio | ✅ | Gravado com autor correto |
| Suporte: leitura administrativa | ✅ | Admin vê chamados de todos |
| Estado vazio do histórico | ✅ | Sem dados fictícios |
| pt-BR e inglês | ✅ | Ambos os locales |
| TypeScript | ✅ | `tsc --noEmit` limpo |
| ESLint | ✅ | Zero erros e avisos |
| Console do navegador | ✅ | Sem erros |
| Sem secrets no frontend | ✅ | Nenhum `service_role` no código |

---

## Pendências

1. **Cadastro e e-mails não validados ponta a ponta.** O GoTrue do
   projeto rejeita domínios não-entregáveis (`.local`, `example.com`) com
   `email_address_invalid`, então não consegui completar um cadastro real
   sem usar um e-mail de verdade. O *caminho de dados* está provado (o
   trigger dispara em qualquer INSERT em `auth.users`, incluindo o do
   GoTrue), mas **confirmação de e-mail, recuperação e redefinição de
   senha precisam de um teste manual seu** com um endereço real — ou
   desligar "Confirm email" no dev.
2. **Stack local nunca executado** (Docker ausente). Rodar
   `npx supabase db reset` após instalar o Docker para confirmar que a
   sequência de migrations aplica limpa do zero.
3. **Preferências de notificação sem persistência** (decisão aprovada). A
   interface diz isso explicitamente ao usuário.
4. **Área de assinatura em estado neutro** até a fase Stripe.
5. **Termos de uso e Política de Privacidade** ainda não existem — são
   referenciados pelo rodapé e pelo cadastro desde o Bloco 1.
6. **Exclusão de conta** permanece desabilitada na interface.

---

## Arquivos criados

```
supabase/config.toml                       supabase/templates/*.html (3)
supabase/migrations/*.sql (6)              supabase/tests/rls.sql
src/lib/supabase/{server,client,middleware}.ts
src/lib/auth/{session,actions}.ts
src/lib/{quiz,profile,support}/actions.ts
src/lib/quiz/claim-client.ts               src/lib/locale-path.ts
src/lib/data/{analysis,quiz-results,admin}.supabase.ts
src/app/[locale]/auth/callback/route.ts
src/app/[locale]/(minimal)/redefinir-senha/page.tsx
src/app/[locale]/(admin)/admin/suporte/page.tsx
src/components/auth/{auth-error,reset-password-form}.tsx
src/components/quiz/quiz-claim-on-mount.tsx
```

## Arquivos alterados

`src/middleware.ts` · `src/lib/data/{index,types}.ts` · layouts `(app)` e
`(admin)` · formulários de auth (3) · `user-menu` · `sidebar` ·
`subscription-tab` · `account-tab` · `notifications-tab` ·
`edit-profile-form` · `contact-form` · `history-list` ·
`recent-activity` · `quiz-flow` · páginas de painel/perfil/histórico/
configurações/admin · `nav-config` · `.env.example` · mensagens i18n (6)

## Arquivos removidos

`src/lib/data/user.mock.ts` · `src/lib/data/admin.mock.ts` ·
`src/lib/supabase/admin.ts` (service role desnecessária)

---

**Próxima fase: Stripe — não iniciar sem autorização explícita.**
