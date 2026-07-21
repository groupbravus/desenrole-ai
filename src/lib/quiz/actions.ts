"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Reivindicação do resultado do quiz (localStorage → banco).
 *
 * IDEMPOTENTE: a chave `clientResultId` é gerada uma única vez no
 * cliente ao concluir o quiz e tem UNIQUE(user_id, client_result_id)
 * no banco. Recarregar a página, repetir o login ou disparar a action
 * duas vezes converge para a mesma linha — nunca duplica.
 *
 * O quiz não concede nenhum acesso: é só um resultado de perfil.
 */
export async function claimQuizResultAction(input: {
  clientResultId: string;
  profile: string;
  scores: Record<string, number>;
  version: string;
  completedAt: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      clientResultId: z.string().min(8).max(64),
      profile: z.enum(["observador", "direto", "ansioso", "quase-la"]),
      scores: z.record(z.string(), z.number().int().min(0).max(100)),
      version: z.string().min(1).max(16),
      completedAt: z.string().datetime(),
    })
    .safeParse(input);

  if (!parsed.success) return { ok: false, code: "invalidInput" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "notAuthenticated" };

  const { error } = await supabase.from("quiz_results").upsert(
    {
      user_id: user.id,
      client_result_id: parsed.data.clientResultId,
      profile: parsed.data.profile,
      scores: parsed.data.scores,
      version: parsed.data.version,
      completed_at: parsed.data.completedAt,
    },
    { onConflict: "user_id,client_result_id", ignoreDuplicates: true },
  );

  if (error) return { ok: false, code: "unknown" };
  return { ok: true };
}
