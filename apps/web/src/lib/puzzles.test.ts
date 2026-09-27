import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { BASE_PUZZLES, puzzleOfTheDay } from "./puzzles";

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
