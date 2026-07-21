import type { ReactNode } from "react";
import { requirePremium } from "@/lib/auth/require-premium";

/**
 * Gate de assinatura para as rotas premium (painel, ferramentas, jogos,
 * histórico). Compõe com o (app)/layout (shell + auth): aqui só exigimos
 * assinatura ativa. Sem entitlement → redireciona para /planos.
 *
 * Ficar num route group `(premium)` mantém as URLs (/painel, /ferramentas…)
 * e centraliza a checagem — nenhuma rota premium escapa do gate.
 */
export default async function PremiumLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePremium();
  return <>{children}</>;
}
