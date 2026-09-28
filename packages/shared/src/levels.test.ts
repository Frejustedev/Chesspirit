import { describe, expect, it } from "vitest";
import { levelFor, xpFor } from "./levels";

describe("niveaux", () => {
  it("calcule les points d'expérience", () => {
    expect(xpFor({})).toBe(0);
    expect(xpFor({ tournaments: 2, games: 10, puzzles: 5, badges: 1 })).toBe(100 + 50 + 10 + 25);
    expect(xpFor({ games: -3, puzzles: 2.7 })).toBe(4);
  });
  it("attribue le niveau du Pion au Roi", () => {
    expect(levelFor(0).level.code).toBe("pawn");
    expect(levelFor(99).level.code).toBe("pawn");
    expect(levelFor(100).level.code).toBe("knight");
    expect(levelFor(2999).level.code).toBe("queen");
    expect(levelFor(3000).level.code).toBe("king");
    expect(levelFor(99999).next).toBeNull();
    expect(levelFor(99999).progress).toBe(1);
  });
  it("mesure la progression vers le niveau suivant", () => {
    const l = levelFor(200);
    expect(l.next?.code).toBe("bishop");
    expect(l.progress).toBeCloseTo(0.5);
    expect(l.toNext).toBe(100);
  });
});
