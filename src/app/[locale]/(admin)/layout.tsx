import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/session";
import { adminNavItems } from "@/lib/nav-config";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Autorização real no servidor: quem não é admin recebe 404 —
  // não confirmamos nem a existência da área. Esconder o menu não é
  // segurança; a checagem é aqui e reforçada por RLS no banco.
  const user = await requireAdmin();

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        items={adminNavItems}
        navNamespace="admin.nav"
        homeHref="/admin"
        variant="admin"
        isAdmin
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          items={adminNavItems}
          navNamespace="admin.nav"
          homeHref="/admin"
          user={user}
        />
        <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
