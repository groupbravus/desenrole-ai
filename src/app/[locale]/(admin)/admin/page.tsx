import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Users, UserPlus, Sparkles, LifeBuoy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { adminRepository } from "@/lib/data";
import { StatCard } from "@/components/dashboard/stat-card";
import { UsersTable } from "@/components/admin/users-table";

export const metadata: Metadata = {
  title: "Painel admin — Labia.ia",
};

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [stats, users] = await Promise.all([
    adminRepository.getStats(),
    adminRepository.getUsers(),
  ]);

  const t = await getTranslations("admin.dashboard");
  const currentLocale = await getLocale();
  const format = (value: number) => value.toLocaleString(currentLocale);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("stats.totalUsers")}
          value={format(stats.totalUsers)}
        />
        <StatCard
          icon={UserPlus}
          label={t("stats.newUsers")}
          value={format(stats.newUsersLast30Days)}
        />
        <StatCard
          icon={Sparkles}
          label={t("stats.quizCompletions")}
          value={format(stats.quizCompletions)}
        />
        <StatCard
          icon={LifeBuoy}
          label={t("stats.openSupport")}
          value={format(stats.openSupportRequests)}
        />
      </div>

      <p className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs text-muted">
        {t("noFinancialsNotice")}
      </p>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("recentUsers")}</h2>
          <Link
            href="/admin/usuarios"
            className="text-sm text-accent hover:underline"
          >
            {t("viewAll")}
          </Link>
        </div>
        <UsersTable users={users.slice(0, 5)} />
      </section>
    </div>
  );
}
