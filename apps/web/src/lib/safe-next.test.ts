import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("refuse les redirections externes", () => {
    expect(safeNext("https://evil.com")).toBe("/compte");
    expect(safeNext("//evil.com")).toBe("/compte");
    expect(safeNext("/\\evil.com")).toBe("/compte");
    expect(safeNext("/competitions/x/inscription")).toBe("/competitions/x/inscription");
    expect(safeNext(null, "/")).toBe("/");
  });
});
