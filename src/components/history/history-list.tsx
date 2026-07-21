import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { TOOL_ICONS, TOOL_MESSAGE_KEY } from "@/components/tools/tool-icons";
import type { AnalysisEntry } from "@/lib/data/types";

export function HistoryList({ entries }: { entries: AnalysisEntry[] }) {
  const t = useTranslations("history");
  const tCatalog = useTranslations("tools.catalog");
  const tStatus = useTranslations("history.status");
  const locale = useLocale();

  if (entries.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="font-medium text-foreground">{t("empty.title")}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          {t("empty.description")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border">
      {entries.map((entry) => {
        const Icon = TOOL_ICONS[entry.tool];
        const key = TOOL_MESSAGE_KEY[entry.tool];
        return (
          <div key={entry.id} className="flex items-start gap-4 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {tCatalog(`${key}.title`)}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {formatDate(entry.createdAt, locale)}
              </p>
            </div>
            <Badge
              variant={entry.status === "completed" ? "success" : "default"}
            >
              {tStatus(entry.status)}
            </Badge>
          </div>
        );
      })}
    </Card>
  );
}
