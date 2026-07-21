"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { computeProfileSlug } from "@/lib/quiz-scoring";
import {
  QUIZ_VERSION,
  storePendingQuizResult,
} from "@/lib/quiz/claim-client";
import type { ProfileSlug, QuizQuestion } from "@/lib/data/types";

const STORAGE_KEY = "desenrole:quiz:v1";
const ADVANCE_DELAY_MS = 260;

/** Tally por perfil — é a "pontuação" persistida junto do resultado. */
function computeScores(answers: Record<string, ProfileSlug>) {
  return Object.values(answers).reduce<Record<string, number>>(
    (acc, profile) => {
      acc[profile] = (acc[profile] ?? 0) + 1;
      return acc;
    },
    {},
  );
}

interface StoredProgress {
  index: number;
  answers: Record<string, ProfileSlug>;
}

export function QuizFlow({ questions }: { questions: QuizQuestion[] }) {
  const t = useTranslations("quiz");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ProfileSlug>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as StoredProgress;
        if (saved.index >= 0 && saved.index < questions.length) {
          setIndex(saved.index);
          setAnswers(saved.answers);
        }
      }
    } catch {
      // localStorage indisponível ou corrompido — segue do início
    }
    setHydrated(true);
  }, [questions.length]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: StoredProgress = { index, answers };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [index, answers, hydrated]);

  if (!hydrated) return null;

  const question = questions[index]!;
  const progress = ((index + 1) / questions.length) * 100;
  const selected = answers[question.id];

  function selectOption(profile: ProfileSlug) {
    const nextAnswers = { ...answers, [question.id]: profile };
    setAnswers(nextAnswers);

    window.setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex((i) => i + 1);
        return;
      }

      const resultSlug = computeProfileSlug(nextAnswers);

      // Guarda o resultado FINAL com uma chave de idempotência. Ele fica
      // aqui até ser confirmado no banco após o cadastro/login — só então
      // é apagado (ver claim-client.ts).
      storePendingQuizResult({
        clientResultId: crypto.randomUUID(),
        profile: resultSlug,
        scores: computeScores(nextAnswers),
        version: QUIZ_VERSION,
        completedAt: new Date().toISOString(),
      });

      // O progresso parcial é descartável.
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/resultado/${resultSlug}`);
    }, ADVANCE_DELAY_MS);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8 md:py-12">
      <div className="mb-10 flex items-center gap-4">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            aria-label={t("back")}
            className="text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <div className="w-5" aria-hidden />
        )}
        <Progress value={progress} className="flex-1" />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-subtle">
          {index + 1}/{questions.length}
        </span>
      </div>

      <div
        key={question.id}
        className="animate-fade-up flex flex-1 flex-col justify-center"
      >
        <h1 className="mb-8 text-2xl font-bold leading-snug tracking-tight md:text-3xl">
          {t(`questions.${question.id}.title`)}
        </h1>

        <div className="space-y-3">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectOption(option.profile)}
              className={cn(
                "w-full rounded-xl border px-5 py-4 text-left text-sm leading-relaxed transition-all duration-200",
                selected === option.profile
                  ? "border-accent bg-accent-muted text-foreground"
                  : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-raised",
              )}
            >
              {t(`questions.${question.id}.options.${option.id}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
