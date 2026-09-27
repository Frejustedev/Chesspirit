/**
 * Cote Chesspirit : méthode Elo.
 * E = 1 / (1 + 10^((Rb - Ra) / 400)) ; R' = R + K × (S - E).
 * K = 40 (moins de 30 parties, ou moins de 18 ans sous 2300), 10 (a atteint 2400), 20 sinon.
 */
export const DEFAULT_START_RATING = 1200;
export const PROVISIONAL_GAMES = 5;

export type Score = 0 | 0.5 | 1;

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

export interface KFactorInput {
  gamesPlayed: number;
  age: number | null;
  rating: number;
  peakRating: number;
}

export function kFactor({ gamesPlayed, age, rating, peakRating }: KFactorInput): 10 | 20 | 40 {
  if (peakRating >= 2400) return 10;
  if (gamesPlayed < 30) return 40;
  if (age !== null && age < 18 && rating < 2300) return 40;
  return 20;
}

export function ratingChange(ra: number, rb: number, score: Score, k: number): number {
  return k * (score - expectedScore(ra, rb));
}

/** Arrondi à l'entier le plus proche, comme l'affichage FIDE. */
export function roundRating(r: number): number {
  return Math.round(r);
}

/**
 * Performance d'un joueur (table FIDE « dp » approchée par l'inverse de la formule Elo),
 * bornée à ±800 points autour de la moyenne des adversaires.
 */
export function performanceRating(opponentRatings: number[], points: number): number | null {
  const n = opponentRatings.length;
  if (n === 0) return null;
  const avg = opponentRatings.reduce((a, b) => a + b, 0) / n;
  const p = points / n;
  if (p >= 1) return Math.round(avg + 800);
  if (p <= 0) return Math.round(avg - 800);
  const dp = -400 * Math.log10(1 / p - 1);
  return Math.round(avg + Math.max(-800, Math.min(800, dp)));
}

export interface RatedGame {
  opponentRating: number;
  score: Score;
}

export interface RatingState {
  rating: number;
  games: number;
  provisional: boolean;
  peak: number;
  /** Parties jouées pendant la période provisoire (pour recalcul par performance). */
  provisionalGames: RatedGame[];
}

export function initialRatingState(
  fideRating: number | null,
  start = DEFAULT_START_RATING,
): RatingState {
  if (fideRating && fideRating > 0) {
    return {
      rating: fideRating,
      games: 0,
      provisional: false,
      peak: fideRating,
      provisionalGames: [],
    };
  }
  return { rating: start, games: 0, provisional: true, peak: start, provisionalGames: [] };
}

/**
 * Applique une partie. Un joueur provisoire voit sa cote remplacée par sa performance
 * sur ses 5 premières parties, puis suit la formule Elo.
 * L'adversaire est pris avec sa cote d'avant la partie (appliquer les deux mises à jour
 * à partir des états d'avant pour rester symétrique).
 */
export function applyGame(state: RatingState, game: RatedGame, age: number | null): RatingState {
  if (state.provisional) {
    const pg = [...state.provisionalGames, game];
    const games = state.games + 1;
    if (pg.length >= PROVISIONAL_GAMES) {
      const perf = performanceRating(
        pg.map((g) => g.opponentRating),
        pg.reduce((a, g) => a + g.score, 0),
      )!;
      return {
        rating: perf,
        games,
        provisional: false,
        peak: Math.max(state.peak, perf),
        provisionalGames: [],
      };
    }
    return { ...state, games, provisionalGames: pg };
  }
  const k = kFactor({
    gamesPlayed: state.games,
    age,
    rating: state.rating,
    peakRating: state.peak,
  });
  const rating = roundRating(
    state.rating + ratingChange(state.rating, game.opponentRating, game.score, k),
  );
  return { ...state, rating, games: state.games + 1, peak: Math.max(state.peak, rating) };
}
