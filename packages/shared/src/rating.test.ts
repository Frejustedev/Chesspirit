import { describe, expect, it } from "vitest";
import {
  applyGame,
  expectedScore,
  initialRatingState,
  kFactor,
  performanceRating,
  ratingChange,
} from "./rating";

describe("cote Chesspirit", () => {
  it("score attendu symétrique", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1);
    expect(expectedScore(1800, 1400)).toBeCloseTo(0.909, 3);
  });

  it("coefficient K selon le brief", () => {
    expect(kFactor({ gamesPlayed: 10, age: 30, rating: 1500, peakRating: 1500 })).toBe(40);
    expect(kFactor({ gamesPlayed: 50, age: 16, rating: 1800, peakRating: 1800 })).toBe(40);
    expect(kFactor({ gamesPlayed: 50, age: 16, rating: 2350, peakRating: 2350 })).toBe(20);
    expect(kFactor({ gamesPlayed: 50, age: 30, rating: 1800, peakRating: 1800 })).toBe(20);
    expect(kFactor({ gamesPlayed: 50, age: 30, rating: 2350, peakRating: 2410 })).toBe(10);
    expect(kFactor({ gamesPlayed: 5, age: 30, rating: 2350, peakRating: 2410 })).toBe(10);
  });

  it("variation R' = R + K(S - E)", () => {
    expect(ratingChange(1500, 1500, 1, 20)).toBeCloseTo(10);
    expect(ratingChange(1500, 1500, 0.5, 20)).toBeCloseTo(0);
    expect(ratingChange(1800, 1400, 0, 20)).toBeCloseTo(-18.18, 1);
  });

  it("performance", () => {
    expect(performanceRating([1500, 1500], 1)).toBe(1500);
    expect(performanceRating([1500], 1)).toBe(2300);
    expect(performanceRating([1500], 0)).toBe(700);
    expect(performanceRating([], 0)).toBeNull();
  });

  it("amorçage : Elo FIDE ou 1200 provisoire recalculé après 5 parties", () => {
    expect(initialRatingState(1850).provisional).toBe(false);
    let s = initialRatingState(null);
    expect(s.rating).toBe(1200);
    for (let i = 0; i < 4; i++) s = applyGame(s, { opponentRating: 1400, score: 1 }, 20);
    expect(s.provisional).toBe(true);
    expect(s.rating).toBe(1200);
    s = applyGame(s, { opponentRating: 1400, score: 0 }, 20);
    expect(s.provisional).toBe(false);
    expect(s.rating).toBe(performanceRating([1400, 1400, 1400, 1400, 1400], 4));
    const before = s.rating;
    s = applyGame(s, { opponentRating: before, score: 1 }, 20);
    expect(s.rating).toBe(before + 20);
  });
});
