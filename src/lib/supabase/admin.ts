import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ============================================================
 * CLIENT SERVICE ROLE (server-only) — ignora RLS
 * ============================================================
 * Usado EXCLUSIVAMENTE pelo módulo de sincronização da Stripe para
 * escrever nas tabelas financeiras (subscriptions, entitlements,
 * stripe_customers, checkout_sessions, webhook_events, sync_log), que
 * são graváveis apenas por service_role.
 *
 * REGRAS:
 * - `server-only`: erro de build se importado por Client Component.
 * - `SUPABASE_SERVICE_ROLE_KEY` nunca em NEXT_PUBLIC_*, nunca em log.
 * - Só pode ser chamado por código de servidor já protegido
 *   (webhook com assinatura válida, action autenticada, cron/admin).
 *
 * Singleton preguiçoso: adia a leitura da env para o primeiro uso, para
 * não quebrar o build quando a chave ainda não está configurada.
 * ============================================================
 */

let instance: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY/URL ausentes: sincronização financeira indisponível.",
    );
  }

  instance = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return instance;
}
