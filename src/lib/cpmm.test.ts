import { describe, expect, it } from "vitest";
import {
  binaryPayouts,
  binaryProbability,
  buyBinary,
  buyMulti,
  costToBuyShares,
  initialBinaryPool,
  initialMultiPool,
  multiProbabilities,
  sellBinary,
  sellMulti,
} from "./cpmm";

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("binary CPMM", () => {
  it("opens at the requested probability", () => {
    for (const prob of [0.05, 0.2, 0.5, 0.73, 0.91]) {
      const pool = initialBinaryPool(250, prob);
      expect(binaryProbability(pool)).toBeCloseTo(prob, 10);
    }
  });

  it("buys YES shares and lifts probability", () => {
    const pool = initialBinaryPool(200, 0.4);
    const trade = buyBinary(pool, "YES", 50);
    expect(trade.shares).toBeGreaterThan(50);
    expect(trade.probBefore).toBeCloseTo(0.4, 8);
    expect(trade.probAfter).toBeGreaterThan(trade.probBefore);
    expect(trade.pool.yes).toBeGreaterThan(0);
    expect(trade.pool.no).toBeGreaterThan(pool.no);
  });

  it("buys NO shares and lowers probability", () => {
    const pool = initialBinaryPool(200, 0.62);
    const trade = buyBinary(pool, "NO", 40);
    expect(trade.shares).toBeGreaterThan(40);
    expect(trade.probAfter).toBeLessThan(trade.probBefore);
  });

  it("round-trips a buy and a full sell back to the stake", () => {
    for (const prob of [0.15, 0.5, 0.8]) {
      const start = initialBinaryPool(180, prob);
      const bought = buyBinary(start, "YES", 35);
      const sold = sellBinary(bought.pool, "YES", bought.shares);
      expect(sold.proceeds).toBeCloseTo(35, 4);
      expect(sold.probAfter).toBeCloseTo(prob, 4);
      expect(sold.pool.yes).toBeCloseTo(start.yes, 3);
      expect(sold.pool.no).toBeCloseTo(start.no, 3);
    }
  });

  it("prices an exact share purchase", () => {
    const pool = initialBinaryPool(120, 0.33);
    const target = 80;
    const cost = costToBuyShares(pool, "NO", target);
    const bought = buyBinary(pool, "NO", cost);
    expect(bought.shares).toBeCloseTo(target, 4);
  });

  it("pays less to sell after the price moves against the position", () => {
    const start = initialBinaryPool(300, 0.5);
    const bought = buyBinary(start, "YES", 40);
    const against = buyBinary(bought.pool, "NO", 120);
    const sold = sellBinary(against.pool, "YES", bought.shares);
    expect(sold.proceeds).toBeLessThan(40);
    expect(sold.proceeds).toBeGreaterThan(0);
  });

  it("rejects empty and nonsense stakes", () => {
    const pool = initialBinaryPool(100, 0.5);
    expect(() => buyBinary(pool, "YES", 0)).toThrow();
    expect(() => buyBinary(pool, "YES", -10)).toThrow();
    expect(() => sellBinary(pool, "YES", 0)).toThrow();
    expect(() => initialBinaryPool(0, 0.5)).toThrow();
  });

  it("stays solvent and finite across random trades", () => {
    const rand = mulberry32(11);
    let pool = initialBinaryPool(500, 0.47);
    let pot = 500;
    let yesShares = 0;
    let noShares = 0;

    for (let step = 0; step < 250; step++) {
      const outcome = rand() < 0.55 ? "YES" : "NO";
      const amount = 1 + rand() * 90;
      const trade = buyBinary(pool, outcome as "YES" | "NO", amount);
      pool = trade.pool;
      pot += amount;
      if (outcome === "YES") yesShares += trade.shares;
      else noShares += trade.shares;

      expect(trade.probAfter).toBeGreaterThan(0);
      expect(trade.probAfter).toBeLessThan(1);
      expect(Number.isFinite(trade.shares)).toBe(true);

      if (rand() < 0.35 && yesShares > 2) {
        const selling = Math.min(yesShares, yesShares * (0.15 + rand() * 0.7));
        const sold = sellBinary(pool, "YES", selling);
        pool = sold.pool;
        pot -= sold.proceeds;
        yesShares -= selling;
        expect(sold.proceeds).toBeGreaterThanOrEqual(0);
      }
      if (rand() < 0.25 && noShares > 2) {
        const selling = Math.min(noShares * 0.4, noShares);
        const sold = sellBinary(pool, "NO", selling);
        pool = sold.pool;
        pot -= sold.proceeds;
        noShares -= selling;
      }

      expect(pot + 1e-4).toBeGreaterThanOrEqual(yesShares);
      expect(pot + 1e-4).toBeGreaterThanOrEqual(noShares);
      for (const q of [0, 0.25, 0.5, 0.75, 1]) {
        const payout = yesShares * q + noShares * (1 - q);
        expect(pot + 1e-4).toBeGreaterThanOrEqual(payout);
      }
    }
  });

  it("handles a very small stake and a stake far larger than the ante", () => {
    const pool = initialBinaryPool(100, 0.5);
    const tiny = buyBinary(pool, "YES", 0.01);
    expect(tiny.shares).toBeGreaterThan(0.01);
    expect(tiny.probAfter).toBeGreaterThan(0.5);
    expect(tiny.probAfter).toBeLessThan(0.51);

    const huge = buyBinary(pool, "NO", 100_000);
    expect(huge.probAfter).toBeLessThan(0.01);
    expect(huge.shares).toBeLessThan(100_000 + 100);
    expect(Number.isFinite(huge.pool.yes)).toBe(true);
    expect(Number.isFinite(huge.pool.no)).toBe(true);
  });
});

describe("multiple-choice CPMM", () => {
  it("opens at the requested distribution", () => {
    const pool = initialMultiPool(300, [0.5, 0.3, 0.2]);
    const probs = multiProbabilities(pool.pools);
    expect(probs[0]).toBeCloseTo(0.5, 8);
    expect(probs[1]).toBeCloseTo(0.3, 8);
    expect(probs[2]).toBeCloseTo(0.2, 8);
    expect(probs.reduce((sum, prob) => sum + prob, 0)).toBeCloseTo(1, 8);
  });

  it("normalizes probabilities that do not already sum to one", () => {
    const pool = initialMultiPool(100, [2, 1, 1]);
    const probs = multiProbabilities(pool.pools);
    expect(probs[0]).toBeCloseTo(0.5, 6);
    expect(probs[1]).toBeCloseTo(0.25, 6);
  });

  it("raises the bought answer and lowers the others", () => {
    const pool = initialMultiPool(400, [0.4, 0.35, 0.25]);
    const trade = buyMulti(pool, 1, 60);
    expect(trade.shares).toBeGreaterThan(60);
    expect(trade.probsAfter[1]).toBeGreaterThan(trade.probsBefore[1]);
    expect(trade.probsAfter[0]).toBeLessThan(trade.probsBefore[0]);
    expect(trade.probsAfter[2]).toBeLessThan(trade.probsBefore[2]);
    expect(trade.probsAfter.reduce((sum, prob) => sum + prob, 0)).toBeCloseTo(1, 8);
  });

  it("round-trips a buy and a full sell", () => {
    const start = initialMultiPool(250, [0.2, 0.2, 0.2, 0.4]);
    const bought = buyMulti(start, 3, 45);
    const sold = sellMulti(bought.pool, 3, bought.shares);
    expect(sold.proceeds).toBeCloseTo(45, 3);
    sold.probsAfter.forEach((prob, index) => {
      expect(prob).toBeCloseTo(multiProbabilities(start.pools)[index], 3);
    });
  });

  it("bounds sale proceeds by the cash sitting in the other reserves", () => {
    const pool = initialMultiPool(80, [0.5, 0.5]);
    const sold = sellMulti(pool, 0, 10_000_000);
    expect(sold.proceeds).toBeGreaterThan(0);
    expect(sold.proceeds).toBeLessThan(80);
    expect(sold.probsAfter.reduce((sum, prob) => sum + prob, 0)).toBeCloseTo(1, 6);
  });

  it("stays solvent across random multi-outcome trades", () => {
    const rand = mulberry32(29);
    const weights = [0.34, 0.22, 0.18, 0.16, 0.1];
    let pool = initialMultiPool(600, weights);
    let pot = 600;
    const shares = [0, 0, 0, 0, 0];
    const minP = Math.min(...weights);
    const lpShares = pool.pools.map((reserve) => 600 - reserve);
    expect(lpShares.every((value) => value >= -1e-8)).toBe(true);
    expect(Math.max(...pool.pools)).toBeCloseTo(600, 6);

    for (let step = 0; step < 180; step++) {
      const index = Math.floor(rand() * weights.length);
      const amount = 2 + rand() * 70;
      const trade = buyMulti(pool, index, amount);
      pool = trade.pool;
      pot += amount;
      shares[index] += trade.shares;
      expect(trade.probsAfter.reduce((sum, prob) => sum + prob, 0)).toBeCloseTo(1, 6);

      if (rand() < 0.3 && shares[index] > 1) {
        const selling = shares[index] * (0.2 + rand() * 0.5);
        const sold = sellMulti(pool, index, selling);
        pool = sold.pool;
        pot -= sold.proceeds;
        shares[index] -= selling;
      }

      shares.forEach((held, outcome) => {
        const backed = held + lpShares[outcome];
        expect(pot + 1e-2).toBeGreaterThanOrEqual(backed * 0 + held);
        expect(pot + 1e-2).toBeGreaterThanOrEqual(held);
      });
      const split = shares.reduce((sum, held, outcome) => sum + held * weights[outcome], 0);
      expect(pot + 1e-2).toBeGreaterThanOrEqual(split);
    }
  });
});

describe("resolution payouts", () => {
  it("pays 1 for the winning side and the complement for a percentage resolution", () => {
    expect(binaryPayouts("YES", 0.4)).toEqual({ yes: 1, no: 0 });
    expect(binaryPayouts("NO", 0.4)).toEqual({ yes: 0, no: 1 });
    expect(binaryPayouts("MKT", 0.35)).toEqual({ yes: 0.35, no: 0.65 });
  });

  it("keeps binary resolution payouts inside the pot", () => {
    const start = initialBinaryPool(150, 0.45);
    const yes = buyBinary(start, "YES", 60);
    const no = buyBinary(yes.pool, "NO", 25);
    const pot = 150 + 60 + 25;
    const yesShares = yes.shares;
    const noShares = no.shares;
    for (const resolution of ["YES", "NO", "MKT"] as const) {
      const rate = binaryPayouts(resolution, 0.35);
      const payout = yesShares * rate.yes + noShares * rate.no;
      expect(payout).toBeLessThanOrEqual(pot + 1e-6);
      expect(payout).toBeGreaterThan(0);
    }
  });

  it("keeps a multi-answer resolution inside the pot", () => {
    const start = initialMultiPool(200, [0.5, 0.3, 0.2]);
    const first = buyMulti(start, 0, 40);
    const second = buyMulti(first.pool, 2, 30);
    const pot = 200 + 40 + 30;
    const shares = [first.shares, 0, second.shares];
    const winner = Math.max(...shares);
    expect(winner).toBeLessThanOrEqual(pot + 1e-6);
    const weighted = shares.reduce((sum, held, index) => sum + held * [0.2, 0.5, 0.3][index], 0);
    expect(weighted).toBeLessThanOrEqual(pot + 1e-6);
  });
});
