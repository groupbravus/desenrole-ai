import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { toolsRepository } from "@/lib/data";
import { TOOL_ICONS, TOOL_MESSAGE_KEY } from "@/components/tools/tool-icons";
import { ToolWorkspace } from "@/components/tools/tool-workspace";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Ferramenta — Labia.ia",
};

export async function generateStaticParams() {
  const tools = await toolsRepository.getTools();
  return tools.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tool = await toolsRepository.getBySlug(slug);
  if (!tool) notFound();

  const Icon = TOOL_ICONS[tool.slug];
  const key = TOOL_MESSAGE_KEY[tool.slug];
  const t = await getTranslations("tools.catalog");
  const tCommon = await getTranslations("tools");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {t(`${key}.title`)}
            </h1>
            {tool.premium && <Badge variant="accent">{tCommon("premium")}</Badge>}
          </div>
          <p className="mt-1 text-muted">{t(`${key}.description`)}</p>
        </div>
      </div>

      <ToolWorkspace slug={tool.slug} />
    </div>
  );
}
