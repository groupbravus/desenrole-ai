import { createClient } from "@/lib/supabase/server";
import type {
  AdminStats,
  AdminUser,
  Role,
  SupportRequest,
} from "./types";

/**
 * ============================================================
 * REPOSITÓRIO ADMINISTRATIVO
 * ============================================================
 * NÃO usa service role. Tudo passa pelo client autenticado normal:
 *
 *  - Listagem de usuários/estatísticas → funções SECURITY DEFINER que
 *    checam `is_admin()` internamente (um não-admin recebe zero linhas).
 *  - Chamados de suporte → RLS comum, cuja policy já permite ao admin
 *    ler todas as linhas.
 *
 * Ou seja: a autorização é do banco, não da aplicação. Mesmo que um
 * guard de rota falhe, um usuário comum não obtém dado administrativo.
 * ============================================================
 */

interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  roles: string[];
}

interface AdminStatsRow {
  total_users: number;
  new_users_30d: number;
  quiz_completions: number;
  open_support: number;
}

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roles: (row.roles ?? []) as Role[],
    createdAt: row.created_at,
  };
}

export const adminRepository = {
  async getStats(): Promise<AdminStats> {
    const supabase = await createClient();
    const { data: raw } = await supabase.rpc("admin_stats").maybeSingle();
    const data = raw as AdminStatsRow | null;

    return {
      totalUsers: Number(data?.total_users ?? 0),
      newUsersLast30Days: Number(data?.new_users_30d ?? 0),
      quizCompletions: Number(data?.quiz_completions ?? 0),
      openSupportRequests: Number(data?.open_support ?? 0),
    };
  },

  async getUsers(): Promise<AdminUser[]> {
    const supabase = await createClient();
    const { data } = await supabase.rpc("admin_list_users");
    return ((data ?? []) as AdminUserRow[]).map(toAdminUser);
  },

  async getUserById(id: string): Promise<AdminUser | null> {
    const supabase = await createClient();
    const { data } = await supabase.rpc("admin_get_user", { _user_id: id });
    const rows = (data ?? []) as AdminUserRow[];
    return rows[0] ? toAdminUser(rows[0]) : null;
  },

  async getSupportRequests(): Promise<SupportRequest[]> {
    const supabase = await createClient();

    const { data } = await supabase
      .from("support_requests")
      .select("id, user_id, subject, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));
  },
};
