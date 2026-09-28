import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { BASE_PUZZLES, puzzleOfTheDay, solvesPuzzle } from "./puzzles";

describe("puzzles de base", () => {
  it.each(BASE_PUZZLES.map((p) => [p.id, p] as const))("%s : la solution mène au mat", (_id, p) => {
    const ch = new Chess(p.fen);
    for (const uci of p.solution) {
      ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    expect(ch.isCheckmate()).toBe(true);
    expect(Math.ceil(p.solution.length / 2)).toBe(p.mateIn);
  });
  it("rotation quotidienne", () => {
    expect(puzzleOfTheDay(new Date("2026-10-03T10:00:00Z")).id).toBeTypeOf("string");
  });
});

describe("vérification des réponses", () => {
  it.each(BASE_PUZZLES.map((p) => [p.id, p] as const))(
    "%s : la solution est acceptée",
    (_id, p) => {
      const mine = p.solution.filter((_, i) => i % 2 === 0);
      expect(solvesPuzzle(p.fen, p.solution, mine)).toBe(true);
    },
  );
  it("refuse une réponse vide, incomplète ou fausse", () => {
    const p = BASE_PUZZLES.find((x) => x.solution.length >= 3)!;
    const mine = p.solution.filter((_, i) => i % 2 === 0);
    expect(solvesPuzzle(p.fen, p.solution, [])).toBe(false);
    expect(solvesPuzzle(p.fen, p.solution, mine.slice(0, -1))).toBe(false);
    expect(solvesPuzzle(p.fen, p.solution, ["a1a1"])).toBe(false);
  });
});
