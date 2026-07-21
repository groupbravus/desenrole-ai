import { createClient } from "@/lib/supabase/server";
import type { QuizResult } from "./types";

/** Resultados de quiz do usuário autenticado (RLS filtra por dono). */
export const quizResultsRepository = {
  async getLatest(): Promise<QuizResult | null> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("quiz_results")
      .select("id, profile, scores, version, completed_at")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      profile: data.profile,
      scores: (data.scores ?? {}) as Record<string, number>,
      version: data.version,
      completedAt: data.completed_at,
    };
  },
};
