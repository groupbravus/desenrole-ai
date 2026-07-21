import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TOOL_ICONS, TOOL_MESSAGE_KEY } from "./tool-icons";
import type { Tool } from "@/lib/data/types";

export function ToolCard({ tool }: { tool: Tool }) {
  const t = useTranslations("tools.catalog");
  const tCommon = useTranslations("tools");
  const Icon = TOOL_ICONS[tool.slug];
  const key = TOOL_MESSAGE_KEY[tool.slug];

  return (
    <Link
      href={`/ferramentas/${tool.slug}`}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-surface p-7 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_0_40px_rgba(230,162,60,0.08)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/[0.05] blur-2xl transition-opacity opacity-0 group-hover:opacity-100"
      />
      <div className="flex h-13 w-13 items-center justify-center rounded-xl bg-accent-muted p-3.5 text-accent">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t(`${key}.title`)}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {t(`${key}.description`)}
        </p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        {tCommon("open")}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden
        />
      </span>
    </Link>
  );
}
