import { describe, expect, it } from "vitest";
import { createBinaryMarket, buy, totalWealth, type Wallet } from "./ledger";
import { cancelLimitOrder, fillLimitOrders, limitIsCrossing, stakeWithinLimit, type LimitOrderState } from "./limits";

function wallets(balances: number[]) {
  const map = new Map<string, Wallet>();
  balances.forEach((balance, index) => map.set(`u${index}`, { id: `u${index}`, balance }));
  return map;
}

describe("limit orders", () => {
  it("sizes a YES limit so the fill stops at the chosen probability", () => {
    const market = createBinaryMarket("m", 200, 0.5);
    const spend = stakeWithinLimit({ yes: market.poolYes, no: market.poolNo, p: market.p }, "YES", 0.62, 80);
    expect(spend).toBeGreaterThanOrEqual(1);
    expect(spend).toBeLessThanOrEqual(80);
    const book = wallets([1000]);
    book.get("u0")!.balance += spend;
    const fill = buy(market, book.get("u0")!, { amount: spend, outcome: "YES" });
    expect(fill.probAfter).toBeLessThanOrEqual(0.62 + 0.01);
    expect(fill.probAfter).toBeGreaterThan(0.5);
  });

  it("rests a limit that is not yet crossing and fills it after the price moves", () => {
    const market = createBinaryMarket("m", 250, 0.55);
    const desk = wallets([1000, 1000]);
    const before = totalWealth([...desk.values()], [market]);
    const order: LimitOrderState = {
      id: "o1",
      userId: "u1",
      outcome: "YES",
      limitProb: 0.48,
      remaining: 40,
      status: "OPEN",
      createdAt: 1,
    };
    desk.get("u1")!.balance -= 40;
    expect(limitIsCrossing(market.probability, order)).toBe(false);
    expect(fillLimitOrders(market, desk, [order])).toHaveLength(0);
    expect(order.status).toBe("OPEN");

    buy(market, desk.get("u0")!, { amount: 80, outcome: "NO" });
    expect(market.probability).toBeLessThan(0.48);
    const fills = fillLimitOrders(market, desk, [order]);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills[0].outcome).toBe("YES");
    expect(market.probability).toBeLessThanOrEqual(0.48 + 0.015);
    expect(order.remaining).toBeLessThan(40);
    const escrow = order.status === "OPEN" ? order.remaining : 0;
    expect(totalWealth([...desk.values()], [market]) + escrow).toBeCloseTo(before, 3);
  });

  it("fills a crossing limit immediately up to its price and leaves the rest working", () => {
    const market = createBinaryMarket("m", 180, 0.4);
    const desk = wallets([500]);
    const order: LimitOrderState = {
      id: "o2",
      userId: "u0",
      outcome: "YES",
      limitProb: 0.7,
      remaining: 30,
      status: "OPEN",
      createdAt: 2,
    };
    desk.get("u0")!.balance -= 30;
    const fills = fillLimitOrders(market, desk, [order]);
    expect(fills.length).toBeGreaterThan(0);
    expect(market.probability).toBeGreaterThan(0.4);
    expect(market.probability).toBeLessThanOrEqual(0.71);
  });

  it("cancels an open limit and returns the escrow", () => {
    const wallet = { id: "u0", balance: 70 };
    const order: LimitOrderState = {
      id: "o3",
      userId: "u0",
      outcome: "NO",
      limitProb: 0.35,
      remaining: 25,
      status: "OPEN",
      createdAt: 3,
    };
    const refund = cancelLimitOrder(order, wallet);
    expect(refund).toBe(25);
    expect(wallet.balance).toBe(95);
    expect(order.status).toBe("CANCELLED");
    expect(cancelLimitOrder(order, wallet)).toBe(0);
  });
});
