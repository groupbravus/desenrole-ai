import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { toolsRepository } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { ToolCard } from "@/components/tools/tool-card";

export const metadata: Metadata = {
  title: "Ferramentas — Desenrole.ai",
};

export default async function FerramentasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tools = await toolsRepository.getTools();
  const t = await getTranslations("tools");

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="relative overflow-hidden text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl"
        />
        <Badge variant="accent" className="mb-4">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t("eyebrow")}
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </div>
  );
}
