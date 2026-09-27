import { describe, expect, it } from "vitest";
import { LEAGUE_TEMPLATE, allocateByRating, seasonMovements } from "./template";

describe("ligues", () => {
  it("modèle : 9 championnats conformes au dossier", () => {
    expect(LEAGUE_TEMPLATE).toHaveLength(9);
    const l1c = LEAGUE_TEMPLATE.find((l) => l.division === "l1" && l.cadence === "classical")!;
    expect([l1c.format, l1c.rounds_count, l1c.base_minutes, l1c.increment_seconds]).toEqual([
      "round_robin",
      11,
      60,
      30,
    ]);
    const l2b = LEAGUE_TEMPLATE.find((l) => l.division === "l2" && l.cadence === "blitz")!;
    expect([l2b.format, l2b.rounds_count]).toEqual(["double_round_robin", 22]);
    expect(LEAGUE_TEMPLATE.filter((l) => l.format === "swiss")).toHaveLength(3);
  });
  it("répartition par la cote", () => {
    const players = Array.from({ length: 30 }, (_, i) => ({ id: i, rating: 2000 - i * 10 }));
    const a = allocateByRating(players);
    expect(a.l1.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(a.l2).toHaveLength(12);
    expect(a.amateur).toHaveLength(6);
  });
  it("montées, descentes et barrage", () => {
    const l1 = Array.from({ length: 12 }, (_, i) => ({ player_id: `a${i + 1}`, rank: i + 1 }));
    const l2 = Array.from({ length: 12 }, (_, i) => ({ player_id: `b${i + 1}`, rank: i + 1 }));
    const m = seasonMovements(l1, l2, {});
    expect(m.promoted).toEqual(["b1", "b2"]);
    expect(m.relegated).toEqual(["a11", "a12"]);
    expect(m.playoff).toEqual(["a10", "b3"]);
  });
});
