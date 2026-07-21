import type { ProfileSlug } from "./data/types";

/** Perfil com mais respostas vence; empate resolve pela ordem de resposta. */
export function computeProfileSlug(
  answers: Record<string, ProfileSlug>,
): ProfileSlug {
  const tally = new Map<ProfileSlug, number>();

  for (const profile of Object.values(answers)) {
    tally.set(profile, (tally.get(profile) ?? 0) + 1);
  }

  let winner: ProfileSlug | null = null;
  let max = -1;
  for (const [profile, count] of tally) {
    if (count > max) {
      max = count;
      winner = profile;
    }
  }

  return winner ?? "observador";
}
