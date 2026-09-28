/**
 * Élimination directe : tableau classique (1 contre dernier, etc.) avec exempts
 * attribués aux meilleures têtes de série quand l'effectif n'est pas une puissance de 2.
 */
export interface KOMatch {
  round: number;
  slot: number;
  a: number | null; // tête de série (1 = meilleure), null = exempt
  b: number | null;
}

export function bracketSize(n: number): number {
  let s = 1;
  while (s < n) s *= 2;
  return s;
}

/** Ordre standard des têtes de série dans un tableau de taille s (1, s, s/2+1, s/2...). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

export function firstRound(nPlayers: number): KOMatch[] {
  const size = bracketSize(nPlayers);
  const order = seedOrder(size);
  const matches: KOMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = order[i]!;
    const b = order[i + 1]!;
    matches.push({
      round: 1,
      slot: i / 2 + 1,
      a: a <= nPlayers ? a : null,
      b: b <= nPlayers ? b : null,
    });
  }
  return matches;
}

/** Départage d'un match nul : parties blitz puis Armageddon (les Blancs doivent gagner). */
export type KOTiebreakStage = "classical" | "blitz" | "armageddon";
export function nextTiebreakStage(stage: KOTiebreakStage): KOTiebreakStage | null {
  return stage === "classical" ? "blitz" : stage === "blitz" ? "armageddon" : null;
}
