import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { quizRepository } from "@/lib/data";
import { QuizFlow } from "@/components/quiz/quiz-flow";

export const metadata: Metadata = {
  title: "Quiz — Desenrole.ai",
};

export default async function QuizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const questions = await quizRepository.getQuestions();

  return <QuizFlow questions={questions} />;
}
