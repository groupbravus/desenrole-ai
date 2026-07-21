"use client";

import { claimQuizResultAction } from "./actions";
import type { ProfileSlug } from "@/lib/data/types";

/**
 * Resultado concluído do quiz aguardando reivindicação.
 * Guardado separado do progresso parcial: o progresso é descartável,
 * este resultado precisa sobreviver até ser confirmado no banco.
 */
export const QUIZ_RESULT_KEY = "desenrole:quiz-result:v1";
export const QUIZ_VERSION = "v1";

export interface PendingQuizResult {
  clientResultId: string;
  profile: ProfileSlug;
  scores: Record<string, number>;
  version: string;
  completedAt: string;
}

export function readPendingQuizResult(): PendingQuizResult | null {
  try {
    const raw = localStorage.getItem(QUIZ_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingQuizResult;
    if (!parsed.clientResultId || !parsed.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storePendingQuizResult(result: PendingQuizResult) {
  try {
    localStorage.setItem(QUIZ_RESULT_KEY, JSON.stringify(result));
  } catch {
    // localStorage indisponível — o quiz segue funcionando sem persistir.
  }
}

/**
 * Persiste o resultado no banco, se houver um pendente.
 *
 * Idempotente por construção: `clientResultId` é a chave de idempotência
 * e o banco tem UNIQUE(user_id, client_result_id). O dado local só é
 * apagado DEPOIS da confirmação de gravação.
 */
export async function claimPendingQuizResult(): Promise<void> {
  const pending = readPendingQuizResult();
  if (!pending) return;

  const result = await claimQuizResultAction(pending);
  if (result.ok) {
    localStorage.removeItem(QUIZ_RESULT_KEY);
  }
}
