/**
 * Tournois par équipes : classement aux points de match ou de partie, appariement suisse
 * des équipes, couleurs par échiquier et contrôle des compositions.
 */
import type { ResultCode } from "./standings";

export type TeamScoring = "match_points" | "game_points";

export interface TeamMatchInput {
  round: number;
  home: string;
  away: string | null; // null = exempt
  /** Résultats par échiquier du point de vue des Blancs, avec la couleur de l'équipe à domicile. */
  boards: { homeIsWhite: boolean; result: ResultCode | null }[];
}

export interface TeamStandingRow {
  rank: number;
  teamId: string;
  matchPoints: number;
  gamePoints: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

const WHITE_POINTS: Record<ResultCode, [number, number]> = {
  "1-0": [1, 0],
  "0-1": [0, 1],
  "1/2-1/2": [0.5, 0.5],
  "+-": [1, 0],
  "-+": [0, 1],
  "=-=": [0.5, 0.5],
  "0-0": [0, 0],
};

/** Points de partie (domicile, extérieur) d'une rencontre ; null tant qu'un échiquier n'a pas de résultat. */
export function matchGamePoints(m: TeamMatchInput): [number, number] | null {
  let h = 0;
  let a = 0;
  for (const b of m.boards) {
    if (!b.result) return null;
    const [w, bl] = WHITE_POINTS[b.result];
    if (b.homeIsWhite) {
      h += w;
      a += bl;
    } else {
      h += bl;
      a += w;
    }
  }
  return [h, a];
}

export function teamStandings(
  teams: { id: string; seed?: number | null }[],
  matches: TeamMatchInput[],
  scoring: TeamScoring = "match_points",
  teamSize = 4,
): TeamStandingRow[] {
  const rows = new Map(
    teams.map((t) => [
      t.id,
      { teamId: t.id, matchPoints: 0, gamePoints: 0, played: 0, wins: 0, draws: 0, losses: 0 },
    ]),
  );
  for (const m of matches) {
    const home = rows.get(m.home);
    if (!home) continue;
    if (m.away === null) {
      // Exempt : 2 points de match et la moitié des points de partie (choix documenté dans DECISIONS.md).
      home.matchPoints += 2;
      home.gamePoints += teamSize / 2;
      home.wins += 1;
      continue;
    }
    const away = rows.get(m.away);
    const gp = matchGamePoints(m);
    if (!away || !gp) continue;
    const [h, a] = gp;
    home.gamePoints += h;
    away.gamePoints += a;
    home.played += 1;
    away.played += 1;
    if (h > a) {
      home.matchPoints += 2;
      home.wins += 1;
      away.losses += 1;
    } else if (a > h) {
      away.matchPoints += 2;
      away.wins += 1;
      home.losses += 1;
    } else {
      home.matchPoints += 1;
      away.matchPoints += 1;
      home.draws += 1;
      away.draws += 1;
    }
  }
  const seed = new Map(teams.map((t, i) => [t.id, t.seed ?? i + 1]));
  const primary = (r: { matchPoints: number; gamePoints: number }) =>
    scoring === "match_points" ? r.matchPoints : r.gamePoints;
  const secondary = (r: { matchPoints: number; gamePoints: number }) =>
    scoring === "match_points" ? r.gamePoints : r.matchPoints;
  const sorted = [...rows.values()].sort(
    (x, y) =>
      primary(y) - primary(x) ||
      secondary(y) - secondary(x) ||
      seed.get(x.teamId)! - seed.get(y.teamId)!,
  );
  let rank = 0;
  return sorted.map((r, i) => {
    const prev = sorted[i - 1];
    if (!prev || primary(prev) !== primary(r) || secondary(prev) !== secondary(r)) rank = i + 1;
    return { ...r, rank };
  });
}

/**
 * Appariement suisse des équipes : ordre du classement, pas de rencontre répétée
 * (recherche avec retour arrière), exempt à l'équipe la moins bien classée qui ne l'a pas eu.
 */
export function pairTeamsSwiss(
  ranking: string[],
  previous: { home: string; away: string | null }[],
): { home: string; away: string | null }[] {
  const met = new Set(
    previous.filter((m) => m.away).map((m) => [m.home, m.away!].sort().join("|")),
  );
  const hadBye = new Set(previous.filter((m) => !m.away).map((m) => m.home));
  let pool = [...ranking];
  let bye: string | null = null;
  if (pool.length % 2 === 1) {
    bye = [...pool].reverse().find((t) => !hadBye.has(t)) ?? pool[pool.length - 1]!;
    pool = pool.filter((t) => t !== bye);
  }
  const homeCount = new Map<string, number>();
  for (const m of previous) {
    homeCount.set(m.home, (homeCount.get(m.home) ?? 0) + 1);
  }
  const solve = (left: string[]): [string, string][] | null => {
    if (!left.length) return [];
    const [a, ...rest] = left;
    for (let i = 0; i < rest.length; i++) {
      const b = rest[i]!;
      if (met.has([a!, b].sort().join("|"))) continue;
      const sub = solve([...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (sub) return [[a!, b], ...sub];
    }
    return null;
  };
  // Si aucune solution sans répétition, on accepte les rencontres répétées plutôt que d'échouer.
  const pairs =
    solve(pool) ??
    pool.reduce<[string, string][]>((acc, t, i) => (i % 2 ? [...acc, [pool[i - 1]!, t]] : acc), []);
  const out: { home: string; away: string | null }[] = pairs.map(([a, b]) =>
    (homeCount.get(a) ?? 0) <= (homeCount.get(b) ?? 0)
      ? { home: a, away: b }
      : { home: b, away: a },
  );
  if (bye) out.push({ home: bye, away: null });
  return out;
}

/** Échiquiers d'une rencontre : l'équipe citée en premier a les Blancs aux échiquiers impairs. */
export function boardColors(boards: number): boolean[] {
  return Array.from({ length: boards }, (_, i) => i % 2 === 0);
}

export interface CompositionRules {
  teamSize: number;
  maxSubstitutes?: number;
  minWomen?: number;
  minYouth?: number;
  youthMaxAge?: number;
}

/** Contrôle d'une composition d'équipe (titulaires + remplaçants) ; renvoie les codes d'erreur. */
export function validateComposition(
  members: { isSubstitute: boolean; sex: "M" | "F" | null; age: number | null }[],
  rules: CompositionRules,
): string[] {
  const errors: string[] = [];
  const starters = members.filter((m) => !m.isSubstitute);
  if (starters.length !== rules.teamSize) errors.push("team_size");
  if (members.length - starters.length > (rules.maxSubstitutes ?? 1))
    errors.push("too_many_substitutes");
  if (rules.minWomen && starters.filter((m) => m.sex === "F").length < rules.minWomen)
    errors.push("min_women");
  if (
    rules.minYouth &&
    starters.filter((m) => m.age !== null && m.age <= (rules.youthMaxAge ?? 18)).length <
      rules.minYouth
  )
    errors.push("min_youth");
  return errors;
}

/** Ordre des échiquiers par cote décroissante (règle par défaut). */
export function boardOrderByRating<T extends { rating: number | null }>(players: T[]): T[] {
  return [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
}
