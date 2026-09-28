/**
 * Cadences selon la FIDE (temps de réflexion par joueur pour 60 coups) :
 * blitz 10 min ou moins, rapide plus de 10 et moins de 60 min, classique 60 min ou plus.
 */
export const RATING_TYPES = ["blitz", "rapid", "classical", "online"] as const;
export type RatingType = (typeof RATING_TYPES)[number];
export type OverTheBoardCadence = Exclude<RatingType, "online">;

export interface TimeControl {
  baseMinutes: number;
  incrementSeconds: number;
}

export function effectiveMinutes(tc: TimeControl): number {
  return tc.baseMinutes + (tc.incrementSeconds * 60) / 60;
}

export function classifyCadence(tc: TimeControl): OverTheBoardCadence {
  const m = effectiveMinutes(tc);
  if (m <= 10) return "blitz";
  if (m < 60) return "rapid";
  return "classical";
}

export function formatTimeControl(tc: TimeControl): string {
  return `${tc.baseMinutes} min + ${tc.incrementSeconds} s`;
}
