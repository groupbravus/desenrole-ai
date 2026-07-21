import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { requireUser, isCurrentUserAdmin } from "@/lib/auth/session";
import { appNavItems } from "@/lib/nav-config";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Guarda de servidor. O middleware já barra o visitante preservando o
  // destino; isto é a defesa em profundidade (e o RLS é o backstop final).
  const user = await requireUser();
  const isAdmin = await isCurrentUserAdmin();

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        items={appNavItems}
        navNamespace="shell.nav"
        homeHref="/painel"
        variant="app"
        isAdmin={isAdmin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          items={appNavItems}
          navNamespace="shell.nav"
          homeHref="/painel"
          user={user}
        />
        <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
