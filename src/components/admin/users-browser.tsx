"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UsersTable } from "./users-table";
import type { AdminUser, Role } from "@/lib/data/types";

const ROLES: Role[] = ["user", "admin"];

export function UsersBrowser({ users }: { users: AdminUser[] }) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("admin.users.roles");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        term.length === 0 ||
        (user.name ?? "").toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);
      const matchesRole = role === "all" || user.roles.includes(role);
      return matchesQuery && matchesRole;
    });
  }, [users, query, role]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-10"
          />
        </div>
        <Select
          value={role}
          onChange={(event) => setRole(event.target.value as "all" | Role)}
          className="sm:w-48"
          options={[
            { value: "all", label: t("allRoles") },
            ...ROLES.map((value) => ({ value, label: tRoles(value) })),
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-muted">
          {t("empty")}
        </p>
      ) : (
        <UsersTable users={filtered} />
      )}
    </div>
  );
}
