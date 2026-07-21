import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./session";
import { hasPremiumAccess } from "@/lib/entitlements";

/**
 * ============================================================
 * GATE DE ASSINATURA (server-only)
 * ============================================================
 * Regra do produto: conta autenticada ≠ conta premium. Somente quem
 * tem entitlement ativo (`entitlements.granted_until > now()`) acessa o
 * painel e as ferramentas. A fonte da verdade é a Stripe → webhook →
 * syncSubscription → entitlements. Nada aqui consulta a Stripe.
 *
 * Duas portas, mesmo critério (`hasPremiumAccess`):
 *  - requirePremium()   → páginas/layouts server: redireciona para /planos.
 *  - premiumApiGuard()  → route handlers: 401 AUTH_REQUIRED / 403
 *                         SUBSCRIPTION_REQUIRED, sem redirecionar.
 *
 * Defesa em profundidade: middleware (auth) → este gate (assinatura) →
 * RLS (backstop de dados). Nenhuma decisão depende do frontend.
 * ============================================================
 */

/**
 * Exige assinatura ativa numa página/layout server. Visitante vai para o
 * login (via requireUser); autenticado sem assinatura vai para /planos.
 */
export async function requirePremium(): Promise<void> {
  await requireUser(); // auth primeiro: visitante → login
  if (!(await hasPremiumAccess())) {
    const locale = await getLocale();
    redirect(`/${locale}/planos`);
  }
}

/**
 * Guarda para APIs/route handlers premium. Retorna uma resposta de erro
 * quando o acesso não é permitido, ou `null` quando pode prosseguir.
 *
 * Uso:
 *   const denied = await premiumApiGuard();
 *   if (denied) return denied;
 *   // ... lógica premium
 */
export async function premiumApiGuard(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }
  if (!(await hasPremiumAccess())) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_REQUIRED" },
      { status: 403 },
    );
  }
  return null;
}
