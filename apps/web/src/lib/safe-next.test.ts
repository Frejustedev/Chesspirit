import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("refuse les redirections externes", () => {
    expect(safeNext("https://evil.com")).toBe("/compte");
    expect(safeNext("//evil.com")).toBe("/compte");
    expect(safeNext("/\\evil.com")).toBe("/compte");
    expect(safeNext("/competitions/x/inscription")).toBe("/competitions/x/inscription");
    expect(safeNext(null, "/")).toBe("/");
    expect(safeNext("/\t/evil.com")).toBe("/compte");
    expect(safeNext("/\n/evil.com")).toBe("/compte");
    expect(safeNext("/\r\\evil.com")).toBe("/compte");
    expect(safeNext("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeNext("/compte?x=1#y")).toBe("/compte?x=1#y");
  });
});
