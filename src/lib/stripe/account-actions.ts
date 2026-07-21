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
  PENDING_CHECKOUT_COOKIE,
} from "./checkout-account";

/**
 * ============================================================
 * CRIAÇÃO / VÍNCULO DE CONTA A PARTIR DO CHECKOUT (server actions)
 * ============================================================
 * A conta só nasce aqui, quando o usuário volta do checkout — NUNCA pelo
 * webhook. Toda ação relê a Stripe (fonte da verdade) e usa o e-mail da
 * SESSÃO (autoritativo), não o do cliente. O webhook apenas mantém
 * customer/subscription/entitlement sincronizados.
 * ============================================================
 */

type Result = { ok: true } | { ok: false; code: string };

/** Vincula customer+subscription ao usuário e sincroniza o entitlement. */
async function linkAndSync(
  userId: string,
  customerId: string,
  subscriptionId: string,
  sessionId: string,
) {
  const admin = createAdminClient();

  await admin
    .from("stripe_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: customerId },
      { onConflict: "user_id" },
    );

  // Registra a sessão como consumida (unique em stripe_checkout_session_id
  // impede que a mesma sessão gere duas contas).
  await admin.from("checkout_sessions").upsert(
    {
      stripe_checkout_session_id: sessionId,
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      status: "complete",
    },
    { onConflict: "stripe_checkout_session_id" },
  );

  await syncSubscription({ subscriptionId, source: "checkout_return" });
}

/**
 * Cria a conta a partir de uma Checkout Session paga. A senha é escolhida
 * agora; o e-mail vem da Stripe. Se o e-mail já existir, não duplica —
 * devolve `email_exists` para o fluxo de login+vínculo.
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

  const locale = await getLocale();
  const admin = createAdminClient();

  // Cria o usuário já confirmado (o pagamento validou a intenção; a senha
  // é definida agora). email_confirm evita e-mail de confirmação.
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
    return { ok: false, code: exists ? "email_exists" : "unknown" };
  }

  const userId = created.user?.id;
  if (!userId) return { ok: false, code: "unknown" };

  // O trigger on_auth_user_created já criou profile + papel 'user'.
  await linkAndSync(userId, v.customerId, v.subscriptionId, v.sessionId);

  // Autentica (define os cookies de sessão) com a senha recém-criada.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: v.email,
    password: parsed.data.password,
  });
  if (signInError) return { ok: false, code: "created_login_failed" };

  (await cookies()).delete(PENDING_CHECKOUT_COOKIE);
  return { ok: true };
}

/**
 * Vincula a assinatura de uma sessão paga à conta JÁ autenticada. Só
 * vincula se o e-mail logado for exatamente o e-mail que pagou.
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

  await linkAndSync(user.id, v.customerId, v.subscriptionId, v.sessionId);

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
