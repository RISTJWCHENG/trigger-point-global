import { describe, expect, it } from "vitest";
import { binaryProbability } from "./cpmm";
import { binaryDepth, subsidizeBinary, subsidizeMulti } from "./liquidity";

describe("liquidity subsidy", () => {
  it("deepens a binary pool and leaves the probability where it was", () => {
    const pool = { yes: 180, no: 260, p: 0.46 };
    const before = binaryProbability(pool);
    const next = subsidizeBinary(pool, 90);
    expect(binaryProbability(next)).toBeCloseTo(before, 12);
    expect(binaryDepth(next)).toBeCloseTo(binaryDepth(pool) + 90, 8);
    expect(next.p).toBe(pool.p);
  });

  it("scales every multiple-choice reserve together", () => {
    const pools = [40, 80, 20];
    const next = subsidizeMulti(pools, 70);
    const price = (values: number[]) => values.map((pool) => 1 / pool / values.reduce((sum, item) => sum + 1 / item, 0));
    expect(price(next).map((value) => Number(value.toFixed(8)))).toEqual(price(pools).map((value) => Number(value.toFixed(8))));
    expect(next.every((pool, index) => pool > pools[index])).toBe(true);
  });
});
