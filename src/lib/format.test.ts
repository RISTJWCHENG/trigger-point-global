import { describe, expect, it } from "vitest";
import { formatSignedTp, formatTp, normalizeMoney } from "./format";

describe("P&L formatting", () => {
  it("turns dust and negative zero into a plain 0.00", () => {
    expect(normalizeMoney(-0.001)).toBe(0);
    expect(normalizeMoney(0.004)).toBe(0);
    expect(formatTp(-0.001)).toBe("0.00");
    expect(formatTp(-0)).toBe("0.00");
    expect(formatSignedTp(-0.004)).toBe("0.00");
    expect(formatSignedTp(0)).toBe("0.00");
  });

  it("keeps real gains and losses signed", () => {
    expect(formatSignedTp(12.5)).toBe("+12.50");
    expect(formatSignedTp(-8.2)).toBe("−8.20");
    expect(formatSignedTp(-0.02)).toBe("−0.02");
  });
});
