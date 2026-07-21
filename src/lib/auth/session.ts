import { cache } from "react";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, Role } from "@/lib/data/types";

/**
 * ============================================================
 * SESSÃO E AUTORIZAÇÃO
 * ============================================================
 * Responsabilidades separadas de propósito:
 *   getCurrentUser()      → apenas identidade
 *   getUserRoles()        → papéis (RBAC)
 *   isCurrentUserAdmin()  → autorização administrativa
 *
 * Assinatura, entitlements e quotas NÃO moram aqui — entram na
 * fase Stripe, em funções próprias.
 *
 * `cache()` deduplica as consultas dentro da mesma requisição.
 * ============================================================
 */

/** Identidade do usuário autenticado, ou null se for visitante. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url, locale, timezone, created_at")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    locale: profile?.locale ?? "pt-BR",
    timezone: profile?.timezone ?? "America/Sao_Paulo",
    memberSince: profile?.created_at ?? user.created_at,
  };
});

/** Papéis do usuário autenticado. Lista vazia para visitante. */
export const getUserRoles = cache(async (): Promise<Role[]> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (data ?? []).map((row) => row.role as Role);
});

/** Autorização administrativa — sempre resolvida no servidor. */
export const isCurrentUserAdmin = cache(async (): Promise<boolean> => {
  const roles = await getUserRoles();
  return roles.includes("admin");
});

/**
 * Exige sessão. Visitante é mandado para o login.
 * O middleware já captura o caso comum preservando o destino (`?next=`);
 * isto aqui é a defesa em profundidade no servidor.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}/login`);
  }
  return user;
}

/**
 * Exige papel de admin. Quem não tem recebe 404 — não confirmamos
 * sequer a existência da área administrativa.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await isCurrentUserAdmin())) notFound();
  return user;
}
