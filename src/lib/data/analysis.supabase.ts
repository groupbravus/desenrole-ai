import { createClient } from "@/lib/supabase/server";
import type { AnalysisEntry } from "./types";

/**
 * Histórico de análises do usuário autenticado.
 *
 * A tabela existe e está protegida por RLS, mas nada a preenche ainda —
 * a geração por IA entra em fase posterior. Contas reais veem estado
 * vazio, que é o comportamento correto (nenhum dado fictício).
 */
export const analysisRepository = {
  async getHistory(): Promise<AnalysisEntry[]> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("analysis_history")
      .select("id, tool, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    return (data ?? []).map((row) => ({
      id: row.id,
      tool: row.tool,
      status: row.status,
      createdAt: row.created_at,
    }));
  },
};
