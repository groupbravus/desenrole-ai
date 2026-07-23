import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { adminRepository } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return { title: t("adminUsuario") };
}

export default async function AdminUsuarioDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await adminRepository.getUserById(id);
  if (!user) notFound();

  const t = await getTranslations("admin.users");
  const tRoles = await getTranslations("admin.users.roles");
  const currentLocale = await getLocale();
  const displayName = user.name ?? user.email;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToList")}
      </Link>

      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <Avatar name={displayName} className="h-16 w-16 text-lg" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{displayName}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {user.roles.map((role) => (
            <Badge key={role} variant={role === "admin" ? "accent" : "default"}>
              {tRoles(role)}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-border">
        <div className="flex items-center justify-between p-5">
          <span className="text-sm text-muted">{t("table.joined")}</span>
          <span className="text-sm font-medium text-foreground">
            {formatDate(user.createdAt, currentLocale)}
          </span>
        </div>
        <div className="flex items-center justify-between p-5">
          <span className="text-sm text-muted">{t("userId")}</span>
          <span className="font-mono text-xs text-foreground">{user.id}</span>
        </div>
      </Card>
    </div>
  );
}
