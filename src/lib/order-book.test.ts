import { describe, expect, it } from "vitest";
import { aggregateOrderBook } from "./order-book";

describe("order book aggregation", () => {
  it("sums resting size at each limit and sorts the best price first", () => {
    const book = aggregateOrderBook([
      { outcome: "YES", limitProb: 0.42, remaining: 10 },
      { outcome: "YES", limitProb: 0.42, remaining: 15 },
      { outcome: "YES", limitProb: 0.37, remaining: 8 },
      { outcome: "NO", limitProb: 0.33, remaining: 20 },
      { outcome: "NO", limitProb: 0.4, remaining: 5 },
      { outcome: "YES", limitProb: 0.5, remaining: 0 },
    ]);
    expect(book.yes).toEqual([
      { limitProb: 0.42, amount: 25 },
      { limitProb: 0.37, amount: 8 },
    ]);
    expect(book.no).toEqual([
      { limitProb: 0.4, amount: 5 },
      { limitProb: 0.33, amount: 20 },
    ]);
  });
});