import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { adminRepository } from "@/lib/data";
import { UsersBrowser } from "@/components/admin/users-browser";

export const metadata: Metadata = {
  title: "Usuários — Admin Labia.ia",
};

export default async function AdminUsuariosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const users = await adminRepository.getUsers();
  const t = await getTranslations("admin.users");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>
      <UsersBrowser users={users} />
    </div>
  );
}
