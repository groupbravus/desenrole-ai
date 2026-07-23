import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gamepad2, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/session";
import { analysisRepository, toolsRepository } from "@/lib/data";
import { ToolCard } from "@/components/tools/tool-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const metadata: Metadata = {
  title: "Painel — Labia.ia",
};

export default async function PainelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, history, tools] = await Promise.all([
    requireUser(),
    analysisRepository.getHistory(),
    toolsRepository.getTools(),
  ]);

  const t = await getTranslations("dashboard");
  const firstName = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("greeting", { name: firstName })}
        </h1>
        <p className="mt-1 text-muted">{t("subtitle")}</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("toolsTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>

      <Link
        href="/jogos"
        className="group flex items-center gap-5 rounded-2xl border border-accent/25 bg-accent-muted/40 p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <Gamepad2 className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">
            {t("gamesCard.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {t("gamesCard.description")}
          </p>
        </div>
        <ArrowRight
          className="h-5 w-5 shrink-0 text-accent transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </Link>

      <RecentActivity entries={history.slice(0, 3)} />
    </div>
  );
}
