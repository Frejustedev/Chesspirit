import { describe, expect, it } from "vitest";
import {
  boardColors,
  matchGamePoints,
  pairTeamsSwiss,
  teamStandings,
  validateComposition,
} from "./teams";

const board = (homeIsWhite: boolean, result: "1-0" | "0-1" | "1/2-1/2") => ({
  homeIsWhite,
  result,
});

describe("équipes", () => {
  it("points de partie avec alternance des couleurs", () => {
    // Domicile : Blancs aux échiquiers 1 et 3.
    const m = {
      round: 1,
      home: "A",
      away: "B",
      boards: [
        board(true, "1-0"),
        board(false, "1-0"),
        board(true, "1/2-1/2"),
        board(false, "0-1"),
      ],
    };
    expect(matchGamePoints(m)).toEqual([2.5, 1.5]);
  });

  it("classement aux points de match puis de partie", () => {
    const teams = [{ id: "A" }, { id: "B" }, { id: "C" }];
    const matches = [
      {
        round: 1,
        home: "A",
        away: "B",
        boards: [board(true, "1-0"), board(false, "0-1"), board(true, "1-0"), board(false, "0-1")],
      },
      { round: 1, home: "C", away: null, boards: [] },
    ];
    const s = teamStandings(teams, matches);
    expect(s[0]).toMatchObject({ teamId: "A", matchPoints: 2, gamePoints: 4, rank: 1 });
    expect(s[1]).toMatchObject({ teamId: "C", matchPoints: 2, gamePoints: 2, rank: 2 });
    expect(s[2]).toMatchObject({ teamId: "B", matchPoints: 0, rank: 3 });
    const g = teamStandings(teams, matches, "game_points");
    expect(g.map((r) => r.teamId)).toEqual(["A", "C", "B"]);
  });

  it("appariement suisse sans répétition et exempt unique", () => {
    const r1 = pairTeamsSwiss(["A", "B", "C", "D", "E"], []);
    expect(r1).toHaveLength(3);
    expect(r1.find((m) => m.away === null)?.home).toBe("E");
    const r2 = pairTeamsSwiss(["A", "B", "C", "D", "E"], r1);
    for (const m of r2.filter((x) => x.away))
      expect(
        r1.some(
          (p) => p.away && [p.home, p.away].sort().join() === [m.home, m.away!].sort().join(),
        ),
      ).toBe(false);
    expect(r2.find((m) => m.away === null)?.home).not.toBe("E");
  });

  it("couleurs et composition", () => {
    expect(boardColors(4)).toEqual([true, false, true, false]);
    const women = (n: number) =>
      Array.from({ length: 4 }, (_, i) => ({
        isSubstitute: false,
        sex: i < n ? ("F" as const) : ("M" as const),
        age: 30,
      }));
    expect(validateComposition(women(1), { teamSize: 4, minWomen: 1 })).toEqual([]);
    expect(validateComposition(women(0), { teamSize: 4, minWomen: 1 })).toEqual(["min_women"]);
    expect(validateComposition(women(0).slice(0, 3), { teamSize: 4 })).toEqual(["team_size"]);
  });
});
