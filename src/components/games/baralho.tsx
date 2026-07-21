"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Layers, Sparkles } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CardLevel = "leve" | "romantico" | "quente";
type LevelFilter = "all" | CardLevel;

interface GameCard {
  level: CardLevel;
  text: string;
}

const LEVELS: LevelFilter[] = ["all", "leve", "romantico", "quente"];

const LEVEL_BADGE: Record<CardLevel, NonNullable<BadgeProps["variant"]>> = {
  leve: "default",
  romantico: "accent",
  quente: "danger",
};

export function Baralho() {
  const t = useTranslations("games.baralho");
  const cards = t.raw("cards") as GameCard[];

  const [filter, setFilter] = useState<LevelFilter>("all");
  const [drawn, setDrawn] = useState<GameCard | null>(null);

  function draw() {
    const pool =
      filter === "all" ? cards : cards.filter((c) => c.level === filter);
    const picked = pool[Math.floor(Math.random() * pool.length)] ?? null;
    setDrawn(picked);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap justify-center gap-2">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFilter(level)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === level
                ? "border-accent bg-accent-muted text-accent"
                : "border-border text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            {t(`levels.${level}`)}
          </button>
        ))}
      </div>

      <div className="relative h-44 w-32" aria-hidden>
        <div className="absolute inset-0 -rotate-6 rounded-xl border border-border bg-surface-raised" />
        <div className="absolute inset-0 rotate-3 rounded-xl border border-border bg-surface-overlay" />
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-accent/30 bg-surface-raised">
          <Sparkles className="h-6 w-6 text-accent/70" />
        </div>
      </div>

      <Button size="lg" onClick={draw}>
        <Layers className="h-4 w-4" aria-hidden />
        {drawn ? t("drawAgain") : t("draw")}
      </Button>

      {drawn && (
        <Card
          key={drawn.text}
          className="animate-fade-up w-full max-w-md border-accent/25 p-6 text-center"
        >
          <Badge variant={LEVEL_BADGE[drawn.level]} className="mb-3">
            {t(`levels.${drawn.level}`)}
          </Badge>
          <p className="leading-relaxed text-foreground">{drawn.text}</p>
        </Card>
      )}
    </div>
  );
}
