/** Contratos de domínio. */

// ============================================================
// IDENTIDADE
// ============================================================
// REGRA: `CurrentUser` contém APENAS identidade. Assinatura,
// entitlements, quotas e papel administrativo são consultas
// separadas (`getUserRoles`, `isCurrentUserAdmin`, e — na fase
// Stripe — `getSubscription`/`getEntitlements`).

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  memberSince: string;
}

export type Role = "user" | "admin";

// ============================================================
// CATÁLOGO (estático nesta fase)
// ============================================================

export interface Plan {
  id: string;
  slug: "weekly" | "monthly";
  priceInCents: number;
  currency: string;
  interval: "week" | "month";
  recommended: boolean;
  featureKeys: string[];
}

export type ToolSlug = "analisar-conversa" | "analisar-story";

export interface Tool {
  slug: ToolSlug;
  icon: string;
  premium: boolean;
}

export interface FaqEntry {
  id: string;
  questionKey: string;
  answerKey: string;
}

// ============================================================
// QUIZ
// ============================================================

export type ProfileSlug = "observador" | "direto" | "ansioso" | "quase-la";

export interface QuizOption {
  id: string;
  profile: ProfileSlug;
}

export interface QuizQuestion {
  id: string;
  options: QuizOption[];
}

export interface QuizProfile {
  slug: ProfileSlug;
  icon: string;
  toolSlug: ToolSlug;
}

/** Resultado final persistido. Sem progresso parcial. */
export interface QuizResult {
  id: string;
  profile: ProfileSlug;
  scores: Record<string, number>;
  version: string;
  completedAt: string;
}

/** Payload da reivindicação (localStorage → banco). Idempotente. */
export interface QuizClaimPayload {
  clientResultId: string;
  profile: ProfileSlug;
  scores: Record<string, number>;
  version: string;
  completedAt: string;
}

// ============================================================
// ANÁLISES (estrutura pronta; IA entra em fase posterior)
// ============================================================

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalysisEntry {
  id: string;
  tool: ToolSlug;
  status: AnalysisStatus;
  createdAt: string;
}

// ============================================================
// SUPORTE
// ============================================================

export type SupportSubject = "billing" | "technical" | "account" | "other";
export type SupportStatus = "open" | "in_progress" | "resolved";

export interface SupportRequest {
  id: string;
  userId: string | null;
  subject: SupportSubject;
  message: string;
  status: SupportStatus;
  createdAt: string;
}

// ============================================================
// ADMIN
// ============================================================
// Sem dados financeiros: Stripe ainda não existe. Nada de plano,
// status de assinatura ou MRR até a fase de pagamento.

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  roles: Role[];
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  newUsersLast30Days: number;
  quizCompletions: number;
  openSupportRequests: number;
}
