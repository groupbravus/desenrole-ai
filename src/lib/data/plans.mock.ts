import type { Plan } from "./types";

const plans: Plan[] = [
  {
    id: "plan_weekly",
    slug: "weekly",
    priceInCents: 1990,
    currency: "BRL",
    interval: "week",
    recommended: false,
    featureKeys: ["allTools", "games", "history"],
  },
  {
    id: "plan_monthly",
    slug: "monthly",
    priceInCents: 4990,
    currency: "BRL",
    interval: "month",
    recommended: true,
    featureKeys: ["allTools", "games", "history", "priority", "savings"],
  },
];

export const plansRepository = {
  async getActivePlans(): Promise<Plan[]> {
    return plans;
  },
  async getBySlug(slug: Plan["slug"]): Promise<Plan | null> {
    return plans.find((p) => p.slug === slug) ?? null;
  },
};
