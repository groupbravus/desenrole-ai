import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { analysisRepository } from "@/lib/data";
import { HistoryList } from "@/components/history/history-list";

export const metadata: Metadata = {
  title: "Histórico — Desenrole.ai",
};

export default async function HistoricoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const history = await analysisRepository.getHistory();
  const t = await getTranslations("history");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 text-muted">{t("pageSubtitle")}</p>
      </div>

      <HistoryList entries={history} />
    </div>
  );
}
