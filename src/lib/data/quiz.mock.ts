import type { QuizProfile, QuizQuestion } from "./types";

const questions: QuizQuestion[] = [
  {
    id: "q1",
    options: [
      { id: "a", profile: "ansioso" },
      { id: "b", profile: "direto" },
      { id: "c", profile: "observador" },
      { id: "d", profile: "quase-la" },
    ],
  },
  {
    id: "q2",
    options: [
      { id: "a", profile: "ansioso" },
      { id: "b", profile: "direto" },
      { id: "c", profile: "observador" },
      { id: "d", profile: "quase-la" },
    ],
  },
  {
    id: "q3",
    options: [
      { id: "a", profile: "observador" },
      { id: "b", profile: "direto" },
      { id: "c", profile: "ansioso" },
      { id: "d", profile: "quase-la" },
    ],
  },
  {
    id: "q4",
    options: [
      { id: "a", profile: "direto" },
      { id: "b", profile: "observador" },
      { id: "c", profile: "ansioso" },
      { id: "d", profile: "quase-la" },
    ],
  },
  {
    id: "q5",
    options: [
      { id: "a", profile: "observador" },
      { id: "b", profile: "ansioso" },
      { id: "c", profile: "direto" },
      { id: "d", profile: "quase-la" },
    ],
  },
  {
    id: "q6",
    options: [
      { id: "a", profile: "ansioso" },
      { id: "b", profile: "observador" },
      { id: "c", profile: "direto" },
      { id: "d", profile: "quase-la" },
    ],
  },
];

const profiles: QuizProfile[] = [
  { slug: "observador", icon: "Eye", toolSlug: "analisar-conversa" },
  { slug: "direto", icon: "Zap", toolSlug: "analisar-story" },
  { slug: "ansioso", icon: "Hourglass", toolSlug: "analisar-conversa" },
  { slug: "quase-la", icon: "Flag", toolSlug: "analisar-story" },
];

export const quizRepository = {
  async getQuestions(): Promise<QuizQuestion[]> {
    return questions;
  },
  async getProfiles(): Promise<QuizProfile[]> {
    return profiles;
  },
  async getProfile(slug: string): Promise<QuizProfile | null> {
    return profiles.find((p) => p.slug === slug) ?? null;
  },
};
