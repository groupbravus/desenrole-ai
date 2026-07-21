import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/lib/data/types";

export function UsersTable({ users }: { users: AdminUser[] }) {
  const t = useTranslations("admin.users.table");
  const tRoles = useTranslations("admin.users.roles");
  const locale = useLocale();

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-subtle">
            <th className="px-5 py-3 font-medium">{t("user")}</th>
            <th className="px-5 py-3 font-medium">{t("role")}</th>
            <th className="px-5 py-3 font-medium">{t("joined")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((user) => {
            const displayName = user.name ?? user.email;
            return (
              <tr
                key={user.id}
                className="transition-colors hover:bg-surface-raised"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/usuarios/${user.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar
                      name={displayName}
                      className="h-8 w-8 text-[11px]"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {user.email}
                      </p>
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge
                        key={role}
                        variant={role === "admin" ? "accent" : "default"}
                      >
                        {tRoles(role)}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">
                  {formatDate(user.createdAt, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
