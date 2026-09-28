import { describe, expect, it } from "vitest";
import { computeStandings, type PairingInput, type PlayerEntry } from "./standings";

const players: PlayerEntry[] = [
  { id: "a", name: "Alpha", rating: 1800 },
  { id: "b", name: "Bravo", rating: 1700 },
  { id: "c", name: "Charlie", rating: 1600 },
  { id: "d", name: "Delta", rating: 1500 },
];

// Toutes rondes à 4 : A bat tout le monde, B bat C et D, C nulle avec D.
const pairings: PairingInput[] = [
  { round: 1, white: "a", black: "d", result: "1-0" },
  { round: 1, white: "b", black: "c", result: "1-0" },
  { round: 2, white: "d", black: "c", result: "1/2-1/2" },
  { round: 2, white: "a", black: "b", result: "1-0" },
  { round: 3, white: "b", black: "d", result: "1-0" },
  { round: 3, white: "c", black: "a", result: "0-1" },
];

describe("classement et départages", () => {
  it("points et rangs", () => {
    const s = computeStandings(players, pairings);
    expect(s.map((r) => [r.playerId, r.points, r.rank])).toEqual([
      ["a", 3, 1],
      ["b", 2, 2],
      ["c", 0.5, 3],
      ["d", 0.5, 3],
    ]);
  });

  it("Buchholz, Sonneborn-Berger, victoires", () => {
    const s = computeStandings(players, pairings, ["sonneborn_berger"]);
    const a = s.find((r) => r.playerId === "a")!;
    expect(a.tiebreaks.buchholz).toBe(3); // 2 + 0.5 + 0.5
    expect(a.tiebreaks.buchholz_cut1).toBe(2.5);
    expect(a.tiebreaks.sonneborn_berger).toBe(3);
    expect(a.tiebreaks.wins).toBe(3);
    const c = s.find((r) => r.playerId === "c")!;
    expect(c.tiebreaks.sonneborn_berger).toBe(0.25);
  });

  it("confrontation directe départage deux ex-æquo", () => {
    const p2: PairingInput[] = [
      { round: 1, white: "c", black: "d", result: "0-1" },
      { round: 1, white: "a", black: "b", result: "1/2-1/2" },
    ];
    const s = computeStandings(players, p2, ["direct_encounter"]);
    expect(s[0]!.playerId).toBe("d");
    expect(s.find((r) => r.playerId === "a")!.tiebreaks.direct_encounter).toBe(0.5);
  });

  it("bye : compte pour le score, pas pour le SB, Buchholz avec adversaire virtuel", () => {
    const three = players.slice(0, 3);
    const p: PairingInput[] = [
      { round: 1, white: "a", black: "b", result: "1-0" },
      { round: 1, white: "c", black: null, result: null, byeKind: "full" },
    ];
    const s = computeStandings(three, p);
    const c = s.find((r) => r.playerId === "c")!;
    expect(c.points).toBe(1);
    expect(c.tiebreaks.sonneborn_berger).toBe(0);
    expect(c.tiebreaks.buchholz).toBe(1);
    expect(c.tiebreaks.wins).toBe(0);
  });

  it("forfait : points mais partie non jouée", () => {
    const s = computeStandings(players.slice(0, 2), [
      { round: 1, white: "a", black: "b", result: "+-" },
    ]);
    expect(s[0]!.points).toBe(1);
    expect(s[0]!.tiebreaks.wins).toBe(0);
  });
});
