"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscription } from "./sync";
import {
  validateCheckoutForSignup,
  emailHasAccount,
  claimCheckoutSession,
  ownsClaim,
  PENDING_CHECKOUT_COOKIE,
} from "./checkout-account";

/**
 * ============================================================
 * CRIAÇÃO / VÍNCULO DE CONTA A PARTIR DO CHECKOUT (server actions)
 * ============================================================
 * A conta nasce via Supabase Admin API (`admin.auth.admin.createUser`),
 * sempre com o e-mail extraído da Checkout Session validada na Stripe —
 * o cliente nunca o informa nem pode alterá-lo. SEM OTP, SEM magic link:
 * a prova de posse do checkout é a própria Checkout Session paga.
 *
 * Ordem de segurança (createAccountFromCheckoutAction):
 *   1. relê a Checkout Session na Stripe
 *   2. cria o usuário (Admin API) — a unicidade de e-mail do Postgres é
 *      o mutex real para duas requisições concorrentes com o mesmo
 *      e-mail: só uma cria, a outra recebe email_exists
 *   3. claim atômico da sessão (RPC) com o user_id recém-criado —
 *      perdedor é compensado (conta deletada) e recebe
 *      CHECKOUT_ALREADY_CLAIMED
 *   4. autentica (permite retomada se o próximo passo falhar)
 *   5. vincula customer/subscription + syncSubscription
 *
 * O webhook (`api/webhooks/stripe`) permanece inalterado: nunca cria
 * conta, nunca define senha, nunca envia convite — só sincroniza.
 * ============================================================
 */

type Result = { ok: true } | { ok: false; code: string };

function mapPasswordError(code: string | undefined): string {
  if (code === "weak_password") return "weakPassword";
  if (code === "same_password") return "samePassword";
  return "unknown";
}

/**
 * Reivindica a sessão para `userId` (idempotente: retomada segura se já
 * era dele) ou devolve o erro de bloqueio se outro usuário já é dono.
 */
async function claimOrBlock(
  admin: ReturnType<typeof createAdminClient>,
  sessionId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "CHECKOUT_ALREADY_CLAIMED" }> {
  const claim = await claimCheckoutSession(admin, sessionId, userId);
  if (!ownsClaim(claim, userId)) {
    return { ok: false, code: "CHECKOUT_ALREADY_CLAIMED" };
  }
  return { ok: true };
}

/** Vincula customer+subscription (sessão já reivindicada) e sincroniza. */
async function linkStripeAndSync(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  customerId: string,
  subscriptionId: string,
  sessionId: string,
): Promise<Result> {
  const { error: custError } = await admin
    .from("stripe_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: "user_id" },
    );
  if (custError) return { ok: false, code: "unknown" };

  // UPDATE (não upsert): a linha já existe pelo claim; restringe a esta
  // sessão E a este dono, nunca toca a de outro usuário.
  const { error: sessError } = await admin
    .from("checkout_sessions")
    .update({ status: "complete", stripe_subscription_id: subscriptionId })
    .eq("stripe_checkout_session_id", sessionId)
    .eq("user_id", userId);
  if (sessError) return { ok: false, code: "unknown" };

  const sync = await syncSubscription({
    subscriptionId,
    source: "checkout_return",
  });
  if (!sync.ok) return { ok: false, code: "sync_failed" };

  return { ok: true };
}

/**
 * Cria a conta a partir de uma Checkout Session paga. E-mail vem da
 * Stripe; nome e senha vêm do formulário. Se o e-mail já tiver conta
 * REAL (com senha), não duplica — devolve `email_exists`.
 */
export async function createAccountFromCheckoutAction(input: {
  sessionId: string;
  name: string;
  password: string;
}): Promise<Result> {
  const parsed = z
    .object({
      sessionId: z.string().min(1),
      name: z.string().min(2),
      password: z.string().min(8),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const v = await validateCheckoutForSignup(parsed.data.sessionId);
  if (!v.ok) return { ok: false, code: v.code };

  let hasAccount: boolean;
  try {
    hasAccount = await emailHasAccount(v.email);
  } catch {
    return { ok: false, code: "unknown" };
  }
  if (hasAccount) return { ok: false, code: "email_exists" };

  const locale = await getLocale();
  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { name: parsed.data.name.trim(), locale },
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const exists =
      error.status === 422 ||
      error.code === "email_exists" ||
      msg.includes("already") ||
      msg.includes("registered");
    if (exists) return { ok: false, code: "email_exists" };
    if (error.code === "weak_password") {
      return { ok: false, code: mapPasswordError(error.code) };
    }
    return { ok: false, code: "unknown" };
  }

  const userId = created.user?.id;
  if (!userId) return { ok: false, code: "unknown" };

  // Reivindica a sessão para ESTE usuário. Se perder (corrida rara em
  // que outra conta já é dona), compensa deletando a conta recém-criada
  // — nenhuma conta órfã sobra, nenhuma sessão fica com dois donos.
  const claim = await claimOrBlock(admin, v.sessionId, userId);
  if (!claim.ok) {
    await admin.auth.admin.deleteUser(userId);
    return claim;
  }

  // Autentica já aqui (não só no final): se o vínculo/sync abaixo falhar,
  // o usuário continua logado e /criar-conta o leva à tela de retomada
  // (vincular), sem precisar recomeçar do zero.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: v.email,
    password: parsed.data.password,
  });
  if (signInError) return { ok: false, code: "created_login_failed" };

  const linked = await linkStripeAndSync(
    admin,
    userId,
    v.customerId,
    v.subscriptionId,
    v.sessionId,
  );
  if (!linked.ok) return linked;

  (await cookies()).delete(PENDING_CHECKOUT_COOKIE);
  return { ok: true };
}

/**
 * Fluxo de conta JÁ EXISTENTE: usuário logado normalmente (senha), mesmo
 * e-mail que pagou. Reivindica (idempotente) e vincula — sem tocar em
 * senha/perfil, que já existem. Também serve para RETOMAR uma finalização
 * interrompida (ex.: syncSubscription falhou antes).
 */
export async function linkCheckoutToCurrentUserAction(input: {
  sessionId: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, code: "not_authenticated" };

  const v = await validateCheckoutForSignup(input.sessionId);
  if (!v.ok) return { ok: false, code: v.code };

  // Segurança: nunca vincular a assinatura de um e-mail a outra conta.
  if (user.email.toLowerCase() !== v.email) {
    return { ok: false, code: "email_mismatch" };
  }

  const admin = createAdminClient();
  const claim = await claimOrBlock(admin, v.sessionId, user.id);
  if (!claim.ok) return claim;

  const linked = await linkStripeAndSync(
    admin,
    user.id,
    v.customerId,
    v.subscriptionId,
    v.sessionId,
  );
  if (!linked.ok) return linked;

  (await cookies()).delete(PENDING_CHECKOUT_COOKIE);
  return { ok: true };
}

/**
 * E-mail já tem conta: guarda o session_id num cookie httpOnly e manda
 * para o login. Depois do login o usuário volta a /criar-conta, que lê o
 * cookie e faz o vínculo. (O `next` do login descarta query string, por
 * isso o cookie.)
 */
export async function beginLinkAction(input: {
  sessionId: string;
}): Promise<void> {
  const locale = await getLocale();
  const v = await validateCheckoutForSignup(input.sessionId);
  if (v.ok) {
    (await cookies()).set(PENDING_CHECKOUT_COOKIE, v.sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 900,
    });
  }
  redirect(
    `/${locale}/login?next=${encodeURIComponent(`/${locale}/criar-conta`)}`,
  );
}
