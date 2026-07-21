/**
 * ============================================================
 * CAMADA DE DADOS
 * ============================================================
 * Dados de USUÁRIO vêm do Supabase (`*.supabase.ts`), protegidos
 * por RLS. Nenhum mock de usuário permanece.
 *
 * Continuam estáticos (catálogo/conteúdo, não dados de usuário):
 *   plans.mock.ts   → catálogo comercial (preço real vem da Stripe)
 *   tools.mock.ts   → catálogo de ferramentas
 *   quiz.mock.ts    → perguntas e perfis do quiz
 *   support.mock.ts → FAQ
 *
 * PROIBIDO nesta camada: simular confirmação de pagamento ou
 * liberação de Premium. Autorização é sempre resolvida no servidor.
 * ============================================================
 */

// Catálogo / conteúdo estático
export { plansRepository } from "./plans.mock";
export { toolsRepository } from "./tools.mock";
export { quizRepository } from "./quiz.mock";
export { supportRepository } from "./support.mock";

// Dados reais do usuário (Supabase + RLS)
export { analysisRepository } from "./analysis.supabase";
export { quizResultsRepository } from "./quiz-results.supabase";
export { adminRepository } from "./admin.supabase";
export { billingRepository } from "./billing.supabase";

export type * from "./types";
