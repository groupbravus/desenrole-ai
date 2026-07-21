"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircleQuestion, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PromptType = "truth" | "dare";

interface Prompt {
  type: PromptType;
  text: string;
}

export function VerdadeConsequencia() {
  const t = useTranslations("games.vc");
  const truths = t.raw("truths") as string[];
  const dares = t.raw("dares") as string[];

  const [prompt, setPrompt] = useState<Prompt | null>(null);

  function pick(type: PromptType) {
    const pool = type === "truth" ? truths : dares;
    const text = pool[Math.floor(Math.random() * pool.length)] ?? "";
    setPrompt({ type, text });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <Button
          size="lg"
          variant="secondary"
          onClick={() => pick("truth")}
        >
          <MessageCircleQuestion className="h-4 w-4" aria-hidden />
          {t("truth")}
        </Button>
        <Button size="lg" onClick={() => pick("dare")}>
          <Flame className="h-4 w-4" aria-hidden />
          {t("dare")}
        </Button>
      </div>

      {prompt && (
        <Card
          key={prompt.text}
          className="animate-fade-up w-full max-w-md border-accent/25 p-6 text-center"
        >
          <Badge
            variant={prompt.type === "truth" ? "accent" : "danger"}
            className="mb-3"
          >
            {prompt.type === "truth" ? t("truthLabel") : t("dareLabel")}
          </Badge>
          <p className="leading-relaxed text-foreground">{prompt.text}</p>
        </Card>
      )}
    </div>
  );
}
