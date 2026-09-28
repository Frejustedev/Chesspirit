import { describe, expect, it } from "vitest";
import { pairSwissFallback, type SwissState } from "./swiss";

function field(n: number): SwissState[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    startNo: i + 1,
    rating: 2000 - i * 50,
    points: 0,
    opponents: [],
    colors: [],
    hadBye: false,
  }));
}

function play(players: SwissState[], pairs: ReturnType<typeof pairSwissFallback>) {
  const by = new Map(players.map((p) => [p.id, p]));
  for (const { white, black } of pairs) {
    const w = by.get(white)!;
    if (!black) {
      w.points += 1;
      w.hadBye = true;
      continue;
    }
    const b = by.get(black)!;
    w.opponents.push(b.id);
    b.opponents.push(w.id);
    w.colors.push("w");
    b.colors.push("b");
    if (w.rating >= b.rating) w.points += 1;
    else b.points += 1;
  }
}

describe("appariement suisse de secours", () => {
  it("ronde 1 : moitié haute contre moitié basse, bye au dernier", () => {
    const p = field(7);
    const pairs = pairSwissFallback(p, 1);
    expect(pairs).toHaveLength(4);
    expect(pairs.at(-1)).toEqual({ white: "p7", black: null });
    const first = pairs[0]!;
    expect([first.white, first.black].sort()).toEqual(["p1", "p4"]);
  });

  it("7 rondes à 12 joueurs sans rematch, couleurs équilibrées", () => {
    const p = field(12);
    for (let r = 1; r <= 7; r++) play(p, pairSwissFallback(p, r));
    for (const x of p) {
      expect(new Set(x.opponents).size).toBe(x.opponents.length);
      const d = x.colors.filter((c) => c === "w").length - x.colors.filter((c) => c === "b").length;
      expect(Math.abs(d)).toBeLessThanOrEqual(2);
    }
  });

  it("un seul bye par joueur et les absents sont exclus", () => {
    const p = field(5);
    const byes = new Set<string>();
    for (let r = 1; r <= 4; r++) {
      const pairs = pairSwissFallback(p, r);
      const b = pairs.find((x) => x.black === null)!;
      expect(byes.has(b.white)).toBe(false);
      byes.add(b.white);
      play(p, pairs);
    }
    p[0]!.absent = true;
    const pairs = pairSwissFallback(p, 5);
    expect(pairs.flatMap((x) => [x.white, x.black])).not.toContain("p1");
  });
});

describe("critères absolus de couleur (FIDE)", () => {
  // Générateur pseudo-aléatoire déterministe (résultats reproductibles).
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it.each([
    [10, 5],
    [12, 7],
    [16, 7],
    [20, 7],
    [30, 7],
    [41, 7],
    [64, 9],
  ])(
    "%i joueurs, %i rondes : écart ≤ 2, jamais trois fois la même couleur, sans rematch",
    (n, rounds) => {
      for (let seed = 1; seed <= 10; seed++) {
        const random = rng(seed * 1000 + n);
        const p = field(n);
        const by = new Map(p.map((x) => [x.id, x]));
        for (let r = 1; r <= rounds; r++) {
          for (const { white, black } of pairSwissFallback(p, r)) {
            const w = by.get(white)!;
            if (!black) {
              w.points += 1;
              w.hadBye = true;
              continue;
            }
            const b = by.get(black)!;
            w.opponents.push(b.id);
            b.opponents.push(w.id);
            w.colors.push("w");
            b.colors.push("b");
            const x = random();
            if (x < 0.45) w.points += 1;
            else if (x < 0.65) {
              w.points += 0.5;
              b.points += 0.5;
            } else b.points += 1;
          }
        }
        for (const x of p) {
          expect(new Set(x.opponents).size).toBe(x.opponents.length);
          const d = x.colors.reduce((s, c) => s + (c === "w" ? 1 : -1), 0);
          expect(Math.abs(d)).toBeLessThanOrEqual(2);
          for (let i = 2; i < x.colors.length; i++)
            expect(x.colors[i] === x.colors[i - 1] && x.colors[i] === x.colors[i - 2]).toBe(false);
        }
      }
    },
  );
});

describe("suisse accéléré (Baku)", async () => {
  const { bakuVirtualPoints } = await import("./swiss");
  it("groupe A et points virtuels par ronde", () => {
    // 20 joueurs, 9 rondes : groupe A = 10, 5 rondes accélérées (1 point aux rondes 1-3, ½ aux rondes 4-5).
    expect(bakuVirtualPoints(10, 20, 1, 9)).toBe(1);
    expect(bakuVirtualPoints(11, 20, 1, 9)).toBe(0);
    expect(bakuVirtualPoints(1, 20, 3, 9)).toBe(1);
    expect(bakuVirtualPoints(1, 20, 4, 9)).toBe(0.5);
    expect(bakuVirtualPoints(1, 20, 6, 9)).toBe(0);
    expect(bakuVirtualPoints(12, 22, 1, 7)).toBe(1);
  });
});
