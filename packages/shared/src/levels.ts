/** Niveaux de la communauté, du Pion au Roi, calculés à partir de l'activité (points d'expérience). */
export const LEVELS = [
  { code: "pawn", piece: "p", min: 0 },
  { code: "knight", piece: "n", min: 100 },
  { code: "bishop", piece: "b", min: 300 },
  { code: "rook", piece: "r", min: 700 },
  { code: "queen", piece: "q", min: 1500 },
  { code: "king", piece: "k", min: 3000 },
] as const;

export type LevelCode = (typeof LEVELS)[number]["code"];

export type Activity = {
  tournaments: number;
  games: number;
  puzzles: number;
  lessons: number;
  predictions: number;
  badges: number;
};

/** Barème : un tournoi pèse plus qu'une partie, chaque badge rapporte un bonus. */
export const XP_RULES: Record<keyof Activity, number> = {
  tournaments: 50,
  games: 5,
  puzzles: 2,
  lessons: 20,
  predictions: 3,
  badges: 25,
};

export function xpFor(a: Partial<Activity>): number {
  let xp = 0;
  for (const k of Object.keys(XP_RULES) as (keyof Activity)[])
    xp += Math.max(0, Math.floor(a[k] ?? 0)) * XP_RULES[k];
  return xp;
}

/** Niveau atteint, prochain niveau et progression (0 à 1) vers celui-ci. */
export function levelFor(xp: number) {
  const x = Math.max(0, xp);
  let i = 0;
  while (i + 1 < LEVELS.length && x >= LEVELS[i + 1]!.min) i++;
  const level = LEVELS[i]!;
  const next = LEVELS[i + 1] ?? null;
  const progress = next ? (x - level.min) / (next.min - level.min) : 1;
  return { level, next, progress, xp: x, toNext: next ? next.min - x : 0 };
}
