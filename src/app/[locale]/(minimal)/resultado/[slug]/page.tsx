import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { quizRepository, toolsRepository } from "@/lib/data";
import { ResultView } from "@/components/quiz/result-view";

export const metadata: Metadata = {
  title: "Seu perfil de comunicação — Desenrole.ai",
};

export async function generateStaticParams() {
  const profiles = await quizRepository.getProfiles();
  return profiles.map((profile) => ({ slug: profile.slug }));
}

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const profile = await quizRepository.getProfile(slug);
  if (!profile) notFound();

  const tool = await toolsRepository.getBySlug(profile.toolSlug);

  return <ResultView profile={profile} tool={tool} />;
}
