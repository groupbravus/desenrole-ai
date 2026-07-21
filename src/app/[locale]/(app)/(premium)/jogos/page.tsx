import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GameSection } from "@/components/games/game-section";
import { Roleta } from "@/components/games/roleta";
import { Baralho } from "@/components/games/baralho";
import { VerdadeConsequencia } from "@/components/games/verdade-consequencia";

export const metadata: Metadata = {
  title: "Jogos — Desenrole.ai",
};

export default async function JogosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("games");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="relative overflow-hidden text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl"
        />
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("pageTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="space-y-4">
        <GameSection
          emoji="🎯"
          title={t("roleta.title")}
          description={t("roleta.description")}
          defaultOpen
        >
          <Roleta />
        </GameSection>

        <GameSection
          emoji="🃏"
          title={t("baralho.title")}
          description={t("baralho.description")}
        >
          <Baralho />
        </GameSection>

        <GameSection
          emoji="🔥"
          title={t("vc.title")}
          description={t("vc.description")}
        >
          <VerdadeConsequencia />
        </GameSection>
      </div>
    </div>
  );
}
