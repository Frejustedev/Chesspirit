/** Chesspirit Tour : barème paramétrable, 6 meilleurs résultats, coefficients (Majeure 1,5 ; en ligne 0,5). */
export const DEFAULT_TOUR_SCALE: number[] = (() => {
  const head = [100, 80, 65, 55, 50, 45, 40, 36, 32, 29];
  const tail: number[] = [];
  for (let p = 28; p >= 1; p--) tail.push(p);
  return [...head, ...tail];
})();
export const DEFAULT_PARTICIPATION_POINTS = 5;
export const DEFAULT_BEST_RESULTS = 6;

export interface TourScaleConfig {
  scale: number[];
  participation: number;
  bestResults: number;
}

export const DEFAULT_TOUR_CONFIG: TourScaleConfig = {
  scale: DEFAULT_TOUR_SCALE,
  participation: DEFAULT_PARTICIPATION_POINTS,
  bestResults: DEFAULT_BEST_RESULTS,
};

export function stagePoints(
  rank: number,
  coefficient: number,
  cfg: TourScaleConfig = DEFAULT_TOUR_CONFIG,
): number {
  const place = cfg.scale[rank - 1] ?? 0;
  return Math.round((place + cfg.participation) * coefficient * 10) / 10;
}

export function tourTotal(points: number[], bestResults = DEFAULT_BEST_RESULTS): number {
  return [...points]
    .sort((a, b) => b - a)
    .slice(0, bestResults)
    .reduce((a, b) => a + b, 0);
}

export const TOUR_CATEGORIES = ["general", "u18", "u14", "women", "over50", "amateur"] as const;
export type TourCategory = (typeof TOUR_CATEGORIES)[number];

export function tourCategories(p: {
  age: number | null;
  /** Tranche d'âge publiée pour les mineurs (leur âge exact n'est pas exposé). */
  ageGroup?: "u14" | "u18" | null;
  sex: "M" | "F" | null;
  rating: number | null;
}): TourCategory[] {
  const c: TourCategory[] = ["general"];
  const u14 = (p.age !== null && p.age < 14) || p.ageGroup === "u14";
  const u18 = u14 || (p.age !== null && p.age < 18) || p.ageGroup === "u18";
  if (u18) c.push("u18");
  if (u14) c.push("u14");
  if (p.sex === "F") c.push("women");
  if (p.age !== null && p.age > 50) c.push("over50");
  if ((p.rating ?? 0) < 1600) c.push("amateur");
  return c;
}
