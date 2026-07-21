import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { TOOL_ICONS, TOOL_MESSAGE_KEY } from "@/components/tools/tool-icons";
import type { AnalysisEntry } from "@/lib/data/types";

export function RecentActivity({ entries }: { entries: AnalysisEntry[] }) {
  const t = useTranslations("dashboard.recentActivity");
  const tCatalog = useTranslations("tools.catalog");
  const locale = useLocale();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <Link href="/historico" className="text-sm text-accent hover:underline">
          {t("viewAll")}
        </Link>
      </div>

      {entries.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">{t("empty")}</Card>
      ) : (
        <Card className="divide-y divide-border">
          {entries.map((entry) => {
            const Icon = TOOL_ICONS[entry.tool];
            const key = TOOL_MESSAGE_KEY[entry.tool];
            return (
              <div key={entry.id} className="flex items-start gap-4 p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {tCatalog(`${key}.title`)}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {formatDate(entry.createdAt, locale)}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
