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

// ---------------------------------------------------------------------------
// Rejeu complet (idempotent) : tournois homologués dans l'ordre chronologique.
// Même algorithme que services/chess-engine/app/rating.py (fixture partagée).
// ---------------------------------------------------------------------------
export type OtbCadence = "blitz" | "rapid" | "classical";

export interface ReplayInput {
  startRating?: number;
  players: Record<
    string,
    { fide?: Partial<Record<OtbCadence, number | null>> | null; birthDate?: string | null }
  >;
  tournaments: {
    id: string;
    date: string;
    cadence: OtbCadence;
    games: { white: string; black: string; score: Score }[];
  }[];
}

export interface ReplayState {
  rating: number;
  games: number;
  provisional: boolean;
  peak: number;
  pending: [number, number][]; // parties provisoires (cote adverse, score)
}

export interface ReplayOutput {
  ratings: Record<OtbCadence, Record<string, Omit<ReplayState, "pending">>>;
  history: {
    tournamentId: string;
    playerId: string;
    cadence: OtbCadence;
    before: number;
    after: number;
    games: number;
  }[];
}

function ageAt(birth: string | null | undefined, date: string): number | null {
  if (!birth) return null;
  const b = new Date(`${birth}T00:00:00Z`);
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  if (
    d.getUTCMonth() < b.getUTCMonth() ||
    (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())
  )
    a--;
  return a;
}

export function replayRatings(input: ReplayInput): ReplayOutput {
  const start = input.startRating ?? DEFAULT_START_RATING;
  const states: Record<OtbCadence, Map<string, ReplayState>> = {
    blitz: new Map(),
    rapid: new Map(),
    classical: new Map(),
  };
  const history: ReplayOutput["history"] = [];
  const tournaments = [...input.tournaments].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

  for (const t of tournaments) {
    const st = states[t.cadence];
    const ids = new Set(t.games.flatMap((g) => [g.white, g.black]));
    for (const id of ids) {
      if (!st.has(id)) {
        const fide = input.players[id]?.fide?.[t.cadence] ?? null;
        st.set(
          id,
          fide && fide > 0
            ? { rating: fide, games: 0, provisional: false, peak: fide, pending: [] }
            : { rating: start, games: 0, provisional: true, peak: start, pending: [] },
        );
      }
    }
    const before = new Map(
      [...ids].map((id) => [id, { ...st.get(id)!, pending: [...st.get(id)!.pending] }]),
    );
    const delta = new Map<string, number>();
    const played = new Map<string, number>();
    const pending = new Map<string, [number, number][]>();
    for (const g of t.games) {
      for (const [me, opp, s] of [
        [g.white, g.black, g.score],
        [g.black, g.white, (1 - g.score) as Score],
      ] as const) {
        const b = before.get(me)!;
        const o = before.get(opp)!;
        played.set(me, (played.get(me) ?? 0) + 1);
        if (b.provisional) {
          pending.set(me, [...(pending.get(me) ?? []), [o.rating, s]]);
        } else {
          const k = kFactor({
            gamesPlayed: b.games,
            age: ageAt(input.players[me]?.birthDate, t.date),
            rating: b.rating,
            peakRating: b.peak,
          });
          delta.set(me, (delta.get(me) ?? 0) + ratingChange(b.rating, o.rating, s, k));
        }
      }
    }
    for (const id of ids) {
      const b = before.get(id)!;
      const n = played.get(id) ?? 0;
      let next: ReplayState;
      if (b.provisional) {
        const all = [...b.pending, ...(pending.get(id) ?? [])];
        if (all.length >= PROVISIONAL_GAMES) {
          const perf = performanceRating(
            all.map((x) => x[0]),
            all.reduce((a, x) => a + x[1], 0),
          )!;
          next = {
            rating: perf,
            games: b.games + n,
            provisional: false,
            peak: Math.max(b.peak, perf),
            pending: [],
          };
        } else {
          next = { ...b, games: b.games + n, pending: all };
        }
      } else {
        const r = Math.round(b.rating + (delta.get(id) ?? 0));
        next = {
          rating: r,
          games: b.games + n,
          provisional: false,
          peak: Math.max(b.peak, r),
          pending: [],
        };
      }
      st.set(id, next);
      history.push({
        tournamentId: t.id,
        playerId: id,
        cadence: t.cadence,
        before: b.rating,
        after: next.rating,
        games: n,
      });
    }
  }
  const strip = (m: Map<string, ReplayState>) =>
    Object.fromEntries([...m].map(([id, { pending: _p, ...s }]) => [id, s]));
  return {
    ratings: {
      blitz: strip(states.blitz),
      rapid: strip(states.rapid),
      classical: strip(states.classical),
    },
    history,
  };
}
