import { describe, expect, it } from "vitest";
import { bergerTables } from "./roundrobin";
import { firstRound, seedOrder } from "./knockout";

function checkComplete(n: number, double = false) {
  const t = bergerTables(n, double);
  const pairs = new Map<string, number>();
  const rounds = new Map<number, Set<number>>();
  for (const p of t) {
    const key = [p.white, p.black].sort((a, b) => a - b).join("-");
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
    const set = rounds.get(p.round) ?? new Set();
    expect(set.has(p.white)).toBe(false);
    expect(set.has(p.black)).toBe(false);
    set.add(p.white).add(p.black);
    rounds.set(p.round, set);
  }
  return { t, pairs, rounds };
}

describe("tables de Berger", () => {
  it("reproduit la table FIDE pour 6 joueurs", () => {
    const t = bergerTables(6);
    const r = (k: number) => t.filter((p) => p.round === k).map((p) => `${p.white}-${p.black}`);
    expect(r(1)).toEqual(["1-6", "2-5", "3-4"]);
    expect(r(2)).toEqual(["6-4", "5-3", "1-2"]);
    expect(r(3)).toEqual(["2-6", "3-1", "4-5"]);
    expect(r(5)).toEqual(["3-6", "4-2", "5-1"]);
  });

  it.each([4, 5, 12])("chaque paire se rencontre une fois (%i joueurs)", (n) => {
    const { pairs, rounds } = checkComplete(n);
    const nn = n % 2 ? n + 1 : n;
    expect(rounds.size).toBe(nn - 1);
    expect([...pairs.values()].every((v) => v === 1)).toBe(true);
    expect(pairs.size).toBe((nn * (nn - 1)) / 2);
  });

  it("aller-retour : 22 rondes pour 12 joueurs, couleurs inversées", () => {
    const { t, pairs } = checkComplete(12, true);
    expect(new Set(t.map((p) => p.round)).size).toBe(22);
    expect([...pairs.values()].every((v) => v === 2)).toBe(true);
    const r1 = t.find((p) => p.round === 1 && p.board === 1)!;
    const r12 = t.find((p) => p.round === 12 && p.board === 1)!;
    expect([r12.white, r12.black]).toEqual([r1.black, r1.white]);
  });
});

describe("élimination directe", () => {
  it("ordre des têtes de série", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("exempts pour les meilleures têtes de série", () => {
    const m = firstRound(6);
    expect(m).toHaveLength(4);
    expect(m[0]).toMatchObject({ a: 1, b: null });
    expect(m.filter((x) => x.b === null)).toHaveLength(2);
  });
});
