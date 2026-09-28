/**
 * Appariement suisse DE SECOURS (non homologué FIDE), utilisé seulement si le service
 * Python (bbpPairings) est indisponible. Règles appliquées :
 * - pas deux fois le même adversaire ;
 * - un seul bye par joueur, attribué au moins bien classé qui n'en a pas eu ;
 * - critères absolus de couleur de la FIDE : écart blancs − noirs jamais au-delà de 2, jamais trois fois
 *   de suite la même couleur (relâchés seulement s'il n'existe aucun appariement qui les respecte) ;
 * - joueurs de même score appariés entre eux, en satisfaisant d'abord les préférences de couleur, puis
 *   moitié haute contre moitié basse autant que possible ;
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

/** Couleur permise par les critères absolus : écart d'au plus 2, pas trois fois de suite la même couleur. */
function canTake(p: SwissState, c: Color) {
  if (Math.abs(colorDiff(p) + (c === "w" ? 1 : -1)) > 2) return false;
  const n = p.colors.length;
  return !(n >= 2 && p.colors[n - 1] === c && p.colors[n - 2] === c);
}

/** Les deux joueurs peuvent se rencontrer sans enfreindre les critères absolus de couleur. */
function colorsCompatible(a: SwissState, b: SwissState) {
  return (canTake(a, "w") && canTake(b, "b")) || (canTake(a, "b") && canTake(b, "w"));
}

/** Couleur attendue : celle qui rééquilibre l'écart, sinon l'inverse de la dernière (aucune au départ). */
function preference(p: SwissState): Color | null {
  const d = colorDiff(p);
  if (d !== 0) return d < 0 ? "w" : "b";
  const last = p.colors.at(-1);
  return last ? (last === "w" ? "b" : "w") : null;
}

/** Attribue les couleurs : le joueur le plus « en retard » de blancs prend les blancs. */
export function allocateColors(
  a: SwissState,
  b: SwissState,
  boardIndex: number,
  round: number,
): [SwissState, SwissState] {
  // Une seule répartition respecte les critères absolus : elle s'impose.
  const aWhite = canTake(a, "w") && canTake(b, "b");
  const bWhite = canTake(b, "w") && canTake(a, "b");
  if (aWhite !== bWhite) return aWhite ? [a, b] : [b, a];
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

  // D'abord avec les critères absolus de couleur ; sans solution, en les relâchant (jamais de rematch).
  const result = backtrack(active, true) ?? backtrack(active, false);
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

function backtrack(
  list: SwissState[],
  strictColors: boolean,
  budget = { n: 200000 },
): [SwissState, SwissState][] | null {
  if (list.length === 0) return [];
  if (--budget.n < 0) return null;
  const [p, ...rest] = list;
  const group = rest.filter((x) => x.points === p!.points);
  const ideal = Math.floor((group.length + 1) / 2) - 1; // moitié haute contre moitié basse
  const want = preference(p!);
  const unhappy = (c: SwissState) => (want && want === preference(c) ? 1 : 0);
  const candidates = rest
    .map((c, idx) => ({ c, idx }))
    .filter(({ c }) => !p!.opponents.includes(c.id) && (!strictColors || colorsCompatible(p!, c)))
    .sort((x, y) => {
      const dx = Math.abs(x.c.points - p!.points);
      const dy = Math.abs(y.c.points - p!.points);
      if (dx !== dy) return dx - dy;
      const ux = unhappy(x.c);
      const uy = unhappy(y.c);
      if (ux !== uy) return ux - uy;
      return Math.abs(x.idx - ideal) - Math.abs(y.idx - ideal);
    });
  for (const { c } of candidates) {
    const sub = backtrack(
      rest.filter((x) => x !== c),
      strictColors,
      budget,
    );
    if (sub) return [[p!, c], ...sub];
  }
  return null;
}

/**
 * Suisse accéléré, méthode Baku (FIDE C.04.5.1) : le groupe A (première moitié du classement
 * initial, arrondie au nombre pair supérieur) reçoit des points virtuels pendant la première
 * moitié des rondes : 1 point sur la première moitié des rondes accélérées, ½ point ensuite.
 * Les points virtuels ne servent qu'à l'appariement, jamais au classement.
 */
export function bakuVirtualPoints(
  startNo: number,
  players: number,
  round: number,
  totalRounds: number,
): number {
  const groupA = 2 * Math.ceil(players / 4);
  if (startNo > groupA) return 0;
  const accelerated = Math.ceil(totalRounds / 2);
  const full = Math.ceil(accelerated / 2);
  return round <= full ? 1 : round <= accelerated ? 0.5 : 0;
}
