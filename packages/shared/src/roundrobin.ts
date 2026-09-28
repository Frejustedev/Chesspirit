/**
 * Tables de Berger (toutes rondes). Pour n joueurs (n impair : un « bye » est ajouté),
 * on obtient n-1 rondes de n/2 appariements. Aller-retour : on ajoute les mêmes rondes,
 * couleurs inversées.
 */
export interface RRPairing {
  round: number;
  board: number;
  white: number; // numéro d'appariement (1..n), 0 = bye
  black: number;
}

export function bergerTables(nPlayers: number, doubleRound = false): RRPairing[] {
  if (nPlayers < 2) return [];
  const n = nPlayers % 2 === 0 ? nPlayers : nPlayers + 1;
  const rounds = n - 1;
  const out: RRPairing[] = [];
  // Méthode du cercle, orientée pour reproduire les tables de Berger FIDE (C.05 annexe 1).
  let ring = Array.from({ length: n - 1 }, (_, i) => i + 1);
  for (let r = 0; r < rounds; r++) {
    const fixed = n;
    const pairs: [number, number][] = [];
    const first = ring[0]!;
    pairs.push(r % 2 === 0 ? [first, fixed] : [fixed, first]);
    for (let i = 1; i < n / 2; i++) {
      pairs.push([ring[i]!, ring[n - 1 - i]!]);
    }
    pairs.forEach(([w, b], i) => {
      const bye = nPlayers % 2 === 1;
      out.push({
        round: r + 1,
        board: i + 1,
        white: bye && w === n ? 0 : w,
        black: bye && b === n ? 0 : b,
      });
    });
    // rotation : le joueur n reste fixe, les autres tournent de n/2 positions.
    ring = [...ring.slice(n / 2), ...ring.slice(0, n / 2)];
  }
  if (doubleRound) {
    const second = out.map((p) => ({
      ...p,
      round: p.round + rounds,
      white: p.black,
      black: p.white,
    }));
    out.push(...second);
  }
  return out;
}
