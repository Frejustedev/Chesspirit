import { describe, expect, it } from "vitest";
import { fenKey } from "./fen-key";

describe("clé de position", () => {
  it("ignore les compteurs de coups", () => {
    expect(fenKey("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1")).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
    );
    expect(fenKey("8/8/8/8/8/8/8/K6k w - - 12 60")).toBe("8/8/8/8/8/8/8/K6k w - -");
  });
  it("refuse une FEN invalide", () => {
    expect(fenKey("n'importe quoi")).toBeNull();
    expect(fenKey("8/8/8/8/8/8/8 w - -")).toBeNull();
    expect(fenKey("8/8/8/8/8/8/8/K6k x - -")).toBeNull();
    expect(fenKey("8/8/8/8/8/8/8/K6k w - e4")).toBeNull();
  });
});
