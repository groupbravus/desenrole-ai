"use client";

import { useEffect } from "react";
import { claimPendingQuizResult } from "@/lib/quiz/claim-client";

/**
 * Reivindica o resultado do quiz feito antes do cadastro.
 *
 * Roda uma vez ao montar a área autenticada. É seguro repetir: a action
 * é idempotente (UNIQUE(user_id, client_result_id)) e o dado local só é
 * apagado depois da confirmação de gravação.
 */
export function QuizClaimOnMount() {
  useEffect(() => {
    void claimPendingQuizResult();
  }, []);

  return null;
}
