import { describe, expect, it } from "vitest";
import fixture from "../fixtures/rating-replay.json";
import { replayRatings, type ReplayInput } from "./rating";

describe("rejeu des cotes (fixture partagée avec le service Python)", () => {
  it("calcule les cotes attendues", () => {
    const out = replayRatings(fixture.input as ReplayInput);
    expect(out.ratings.rapid).toEqual(fixture.expected.ratings.rapid);
    for (const [pid, [before, after]] of Object.entries(fixture.expected.history_t1)) {
      expect(out.history.find((h) => h.tournamentId === "t1" && h.playerId === pid)).toMatchObject({
        before,
        after,
      });
    }
  });
  it("est idempotent et indépendant de l'ordre fourni", () => {
    const a = replayRatings(fixture.input as ReplayInput);
    const b = replayRatings({
      ...(fixture.input as ReplayInput),
      tournaments: [...fixture.input.tournaments].reverse() as ReplayInput["tournaments"],
    });
    expect(a).toEqual(b);
  });
});
