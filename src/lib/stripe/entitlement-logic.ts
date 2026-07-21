/**
 * ============================================================
 * LÓGICA PURA DE ENTITLEMENT (sem I/O — testável isoladamente)
 * ============================================================
 * Converte o estado de uma assinatura da Stripe no `granted_until` que a
 * tabela `entitlements` guarda. A aplicação decide Premium SOMENTE por
 * `entitlements.granted_until > now()` — nunca consulta a Stripe.
 *
 * Escopo V1 congelado: grace period de 3 dias em past_due; sem trial
 * (tratado com segurança mesmo assim); reembolso/disputa removem acesso
 * (a remoção efetiva é o sync gravar granted_until no passado — feito na
 * S5 ao tratar os eventos de refund/dispute).
 * ============================================================
 */

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export const GRACE_PERIOD_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

/**
 * Deriva até quando o acesso Premium é válido para um dado estado.
 * Retorna null quando não há acesso.
 *
 * - active / trialing → até current_period_end
 * - past_due          → até current_period_end + 3 dias (grace)
 * - canceled          → até current_period_end (se já passou, sem acesso)
 * - unpaid / incomplete / incomplete_expired / paused → sem acesso
 */
export function deriveGrantedUntil(
  snapshot: SubscriptionSnapshot,
  graceDays: number = GRACE_PERIOD_DAYS,
): Date | null {
  const { status, currentPeriodEnd } = snapshot;

  switch (status) {
    case "active":
    case "trialing":
      return currentPeriodEnd;

    case "past_due":
      if (!currentPeriodEnd) return null;
      return new Date(currentPeriodEnd.getTime() + graceDays * DAY_MS);

    case "canceled":
      // Acesso até o fim do período já pago. Se current_period_end já
      // passou, o próprio `granted_until > now()` nega o acesso.
      return currentPeriodEnd;

    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return null;

    default:
      // Estado desconhecido → conservador: sem acesso.
      return null;
  }
}

/** Acesso Premium ativo em um instante de referência. */
export function isAccessActive(
  grantedUntil: Date | null,
  now: Date = new Date(),
): boolean {
  return grantedUntil !== null && grantedUntil.getTime() > now.getTime();
}

/**
 * Guarda contra eventos fora de ordem: só aplica se o evento recebido for
 * mais recente (ou igual) ao último já sincronizado. Evento mais antigo
 * que o último sincronizado é ignorado (não regride o estado).
 */
export function shouldApplyEvent(
  incomingEventAt: Date,
  lastSyncedEventAt: Date | null,
): boolean {
  if (lastSyncedEventAt === null) return true;
  return incomingEventAt.getTime() >= lastSyncedEventAt.getTime();
}
