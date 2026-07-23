import "server-only";
import OpenAI from "openai";

/**
 * ============================================================
 * INSTÂNCIA ÚNICA DA OPENAI (server-only, singleton preguiçoso)
 * ============================================================
 * Mesmo padrão de `src/lib/stripe.ts`: `server-only` garante erro de
 * build se importado por um Client Component, e a criação é adiada
 * para o primeiro uso real (o construtor da SDK lança com chave vazia,
 * e não queremos que isso quebre `next build` quando a variável ainda
 * não estiver configurada no ambiente).
 * ============================================================
 */

let instance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (instance) return instance;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY não configurada. Defina-a no ambiente do servidor.",
    );
  }

  instance = new OpenAI({ apiKey });

  return instance;
}
