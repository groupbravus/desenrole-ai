import "server-only";
import Stripe from "stripe";

/**
 * ============================================================
 * INSTÂNCIA ÚNICA DA STRIPE (server-only, singleton preguiçoso)
 * ============================================================
 * `server-only` garante erro de build se este arquivo for importado por
 * um Client Component. A `STRIPE_SECRET_KEY` é secreta e nunca vai ao
 * navegador (só a publishable key é pública).
 *
 * Por que preguiçoso e não `export const stripe = new Stripe(...)`:
 * o construtor da SDK LANÇA com chave vazia, e o `next build` avalia o
 * módulo do route handler do webhook. Com a instância eager, o build
 * quebraria sempre que a `STRIPE_SECRET_KEY` não estivesse presente
 * (ex.: durante a fase S0, sem chaves ainda). O singleton adia a criação
 * para o primeiro uso real no servidor — continua sendo **uma única
 * instância** reaproveitada em todo o processo.
 *
 * A versão de API é fixada para que updates do SDK não mudem o
 * comportamento sem revisão.
 * ============================================================
 */

let instance: Stripe | null = null;

export function getStripe(): Stripe {
  if (instance) return instance;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY não configurada. Defina-a no ambiente do servidor.",
    );
  }

  instance = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
    appInfo: { name: "desenrole.ai" },
  });

  return instance;
}
