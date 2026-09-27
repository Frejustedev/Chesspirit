/**
 * Classement et départages d'un tournoi à partir des résultats ronde par ronde.
 * Byes et forfaits : traités comme des parties non jouées (règlement FIDE des départages 2023) :
 * - ils comptent pour le score ;
 * - pour le Buchholz, chaque ronde non jouée vaut le score propre du joueur (adversaire virtuel) ;
 * - ils n'entrent ni dans le Sonneborn-Berger, ni dans les victoires jouées, ni dans la performance.
 */
import { performanceRating } from "./rating";

export const TIEBREAKS = [
  "buchholz",
  "buchholz_cut1",
  "sonneborn_berger",
  "direct_encounter",
  "wins",
  "performance",
] as const;
export type Tiebreak = (typeof TIEBREAKS)[number];

export type ResultCode = "1-0" | "0-1" | "1/2-1/2" | "+-" | "-+" | "=-=" | "0-0";
export type ByeKind = "full" | "half" | "zero";

export interface PlayerEntry {
  id: string;
  name: string;
  rating: number | null;
}

export interface PairingInput {
  round: number;
  white: string;
  black: string | null; // null = bye
  result: ResultCode | null; // null = pas encore joué
  byeKind?: ByeKind;
}

interface RoundRecord {
  round: number;
  opponent: string | null;
  points: number;
  played: boolean; // partie réellement jouée sur l'échiquier
  win: boolean;
}

export interface StandingRow {
  rank: number;
  playerId: string;
  name: string;
  rating: number | null;
  points: number;
  games: number;
  tiebreaks: Record<Tiebreak, number>;
}

const RESULT_POINTS: Record<ResultCode, [number, number, boolean]> = {
  "1-0": [1, 0, true],
  "0-1": [0, 1, true],
  "1/2-1/2": [0.5, 0.5, true],
  "+-": [1, 0, false], // forfait noir
  "-+": [0, 1, false], // forfait blanc
  "=-=": [0.5, 0.5, false], // nulle administrative
  "0-0": [0, 0, false], // double forfait
};

const BYE_POINTS: Record<ByeKind, number> = { full: 1, half: 0.5, zero: 0 };

export function buildRecords(players: PlayerEntry[], pairings: PairingInput[]) {
  const recs = new Map<string, RoundRecord[]>(players.map((p) => [p.id, []]));
  for (const p of pairings) {
    if (p.black === null) {
      recs.get(p.white)?.push({
        round: p.round,
        opponent: null,
        points: BYE_POINTS[p.byeKind ?? "full"],
        played: false,
        win: false,
      });
      continue;
    }
    if (p.result === null) continue;
    const [w, b, played] = RESULT_POINTS[p.result];
    recs
      .get(p.white)
      ?.push({ round: p.round, opponent: p.black, points: w, played, win: played && w === 1 });
    recs
      .get(p.black)
      ?.push({ round: p.round, opponent: p.white, points: b, played, win: played && b === 1 });
  }
  return recs;
}

export function computeStandings(
  players: PlayerEntry[],
  pairings: PairingInput[],
  order: Tiebreak[] = ["buchholz_cut1", "buchholz", "sonneborn_berger"],
): StandingRow[] {
  const recs = buildRecords(players, pairings);
  const score = new Map<string, number>();
  for (const [id, r] of recs)
    score.set(
      id,
      r.reduce((a, x) => a + x.points, 0),
    );
  const ratingOf = new Map(players.map((p) => [p.id, p.rating]));

  const oppScores = (id: string): number[] =>
    (recs.get(id) ?? []).map((r) =>
      r.played && r.opponent ? (score.get(r.opponent) ?? 0) : (score.get(id) ?? 0),
    );

  const rows = players.map((p) => {
    const r = recs.get(p.id) ?? [];
    const os = oppScores(p.id);
    const buchholz = sum(os);
    const cut1 = os.length > 1 ? buchholz - Math.min(...os) : buchholz;
    const sb = sum(
      r.filter((x) => x.played && x.opponent).map((x) => x.points * (score.get(x.opponent!) ?? 0)),
    );
    const playedOpp = r.filter((x) => x.played && x.opponent);
    const oppRatings = playedOpp
      .map((x) => ratingOf.get(x.opponent!))
      .filter((v): v is number => typeof v === "number");
    const perf =
      oppRatings.length === playedOpp.length && oppRatings.length > 0
        ? (performanceRating(oppRatings, sum(playedOpp.map((x) => x.points))) ?? 0)
        : 0;
    return {
      rank: 0,
      playerId: p.id,
      name: p.name,
      rating: p.rating,
      points: score.get(p.id) ?? 0,
      games: r.length,
      tiebreaks: {
        buchholz,
        buchholz_cut1: cut1,
        sonneborn_berger: sb,
        direct_encounter: 0,
        wins: r.filter((x) => x.win).length,
        performance: perf,
      },
    } satisfies StandingRow;
  });

  // Confrontation directe : calculée au sein de chaque groupe d'ex-æquo.
  if (order.includes("direct_encounter")) {
    const groups = groupBy(rows, (r) => r.points);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const ids = new Set(g.map((x) => x.playerId));
      for (const row of g) {
        row.tiebreaks.direct_encounter = sum(
          (recs.get(row.playerId) ?? [])
            .filter((x) => x.opponent && ids.has(x.opponent) && x.played)
            .map((x) => x.points),
        );
      }
    }
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const tb of order) {
      const d = b.tiebreaks[tb] - a.tiebreaks[tb];
      if (Math.abs(d) > 1e-9) return d;
    }
    return (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name);
  });

  let rank = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      order.every((tb) => Math.abs(prev.tiebreaks[tb] - row.tiebreaks[tb]) < 1e-9);
    rank = tied ? rank : i + 1;
    row.rank = rank;
  });
  return rows;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
