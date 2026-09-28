import { describe, expect, it } from "vitest";
import { safeKey, split } from "./chunks";

describe("stockage sécurisé", () => {
  it("découpe et recompose une valeur longue", () => {
    const v = "x".repeat(5000);
    const parts = split(v);
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.length <= 1800)).toBe(true);
    expect(parts.join("")).toBe(v);
    expect(split("")).toEqual([""]);
  });
  it("produit des clés valides", () => {
    expect(safeKey("sb-localhost:54321-auth-token")).toBe("sb-localhost_54321-auth-token");
  });
});
