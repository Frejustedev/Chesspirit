import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "./csv";

describe("CSV", () => {
  it("neutralise les formules et protège les séparateurs", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("x\n=HYPERLINK(1)")).toBe('"x\n=HYPERLINK(1)"');
    expect(csvCell("\n=1+1")).toBe('"\'\n=1+1"');
    expect(csvCell('a;"b"')).toBe('"a;""b"""');
    expect(csvRow(["Littoral", 12, null])).toBe("Littoral;12;");
  });
});
