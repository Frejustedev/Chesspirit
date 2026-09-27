/**
 * Appariement suisse DE SECOURS (non homologué FIDE), utilisé seulement si le service
 * Python (bbpPairings) est indisponible. Règles appliquées :
 * - pas deux fois le même adversaire ;
 * - un seul bye par joueur, attribué au moins bien classé qui n'en a pas eu ;
 * - joueurs de même score appariés entre eux (moitié haute contre moitié basse) autant que possible ;
 * - couleurs équilibrées (différence blancs − noirs, puis alternance).
 */
export type Color = "w" | "b";

export interface SwissState {
  id: string;
  startNo: number;
  rating: number;
  points: number;
  opponents: string[];
  colors: Color[]; // couleurs des parties jouées, dans l'ordre
  hadBye: boolean;
  absent?: boolean;
}

export interface SwissPair {
  white: string;
  black: string | null;
}

const rankOrder = (a: SwissState, b: SwissState) =>
  b.points - a.points || b.rating - a.rating || a.startNo - b.startNo;

function colorDiff(p: SwissState) {
  return p.colors.reduce((d, c) => d + (c === "w" ? 1 : -1), 0);
}

/** Attribue les couleurs : le joueur le plus « en retard » de blancs prend les blancs. */
export function allocateColors(
  a: SwissState,
  b: SwissState,
  boardIndex: number,
  round: number,
): [SwissState, SwissState] {
  const da = colorDiff(a);
  const db = colorDiff(b);
  if (da !== db) return da < db ? [a, b] : [b, a];
  const la = a.colors.at(-1);
  const lb = b.colors.at(-1);
  if (la && lb && la !== lb) return la === "b" ? [a, b] : [b, a];
  // Premier de l'appariement : alterne selon l'échiquier et la ronde (tirage « blancs au n° 1 »).
  const higherFirst = rankOrder(a, b) <= 0 ? [a, b] : [b, a];
  const whiteToHigher = la ? la === "b" : (boardIndex + round) % 2 === 1;
  return whiteToHigher ? [higherFirst[0]!, higherFirst[1]!] : [higherFirst[1]!, higherFirst[0]!];
}

export function pairSwissFallback(players: SwissState[], round: number): SwissPair[] {
  const active = players.filter((p) => !p.absent).sort(rankOrder);
  const pairs: SwissPair[] = [];
  let bye: SwissState | null = null;
  if (active.length % 2 === 1) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (!active[i]!.hadBye) {
        bye = active.splice(i, 1)[0]!;
        break;
      }
    }
    bye ??= active.pop()!;
  }

  const result = backtrack(active);
  if (!result) throw new Error("Aucun appariement possible sans rematch");
  const boards = result
    .map(([a, b]) => ({ a, b, key: Math.max(a.points, b.points) * 10000 + a.rating + b.rating }))
    .sort((x, y) => y.key - x.key);
  boards.forEach(({ a, b }, i) => {
    const [w, bl] = allocateColors(a, b, i, round);
    pairs.push({ white: w.id, black: bl.id });
  });
  if (bye) pairs.push({ white: bye.id, black: null });
  return pairs;
}

function backtrack(list: SwissState[], budget = { n: 200000 }): [SwissState, SwissState][] | null {
  if (list.length === 0) return [];
  if (--budget.n < 0) return null;
  const [p, ...rest] = list;
  const group = rest.filter((x) => x.points === p!.points);
  const ideal = Math.floor((group.length + 1) / 2) - 1; // moitié haute contre moitié basse
  const candidates = rest
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => !p!.opponents.includes(c.id))
    .sort((x, y) => {
      const dx = Math.abs(x.c.points - p!.points);
      const dy = Math.abs(y.c.points - p!.points);
      if (dx !== dy) return dx - dy;
      return Math.abs(x.idx - ideal) - Math.abs(y.idx - ideal);
    });
  for (const { c } of candidates) {
    const sub = backtrack(
      rest.filter((x) => x !== c),
      budget,
    );
    if (sub) return [[p!, c], ...sub];
  }
  return null;
}
