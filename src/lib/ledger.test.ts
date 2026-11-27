import { describe, expect, it } from "vitest";
import { TradeError } from "./errors";
import {
  buy,
  createBinaryMarket,
  createMultiMarket,
  quoteHoldings,
  resolveMarket,
  sell,
  totalWealth,
  type LedgerMarket,
  type Wallet,
} from "./ledger";

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

function desk(balances: number[]) {
  const wallets = new Map<string, Wallet>();
  balances.forEach((balance, index) => {
    wallets.set(`u${index}`, { id: `u${index}`, balance });
  });
  return wallets;
}

function wealth(wallets: Map<string, Wallet>, markets: LedgerMarket[]) {
  return totalWealth([...wallets.values()], markets);
}

describe("ledger trades", () => {
  it("debits the buyer, raises YES probability, and credits shares", () => {
    const market = createBinaryMarket("m", 200, 0.4);
    const wallets = desk([1000, 1000]);
    const before = wealth(wallets, [market]);
    const fill = buy(market, wallets.get("u0")!, { amount: 50, outcome: "YES" });
    expect(fill.shares).toBeGreaterThan(50);
    expect(fill.probAfter).toBeGreaterThan(0.4);
    expect(wallets.get("u0")!.balance).toBeCloseTo(950, 6);
    expect(market.pot).toBeCloseTo(250, 6);
    expect(market.positions[0].sharesYes).toBeCloseTo(fill.shares, 8);
    expect(wealth(wallets, [market])).toBeCloseTo(before, 6);
  });

  it("buys NO and round-trips a full sell back to the stake", () => {
    const market = createBinaryMarket("m", 180, 0.66);
    const wallets = desk([800]);
    const start = wallets.get("u0")!.balance;
    const fill = buy(market, wallets.get("u0")!, { amount: 42, outcome: "NO" });
    expect(fill.probAfter).toBeLessThan(0.66);
    const sold = sell(market, wallets.get("u0")!, { shares: fill.shares, outcome: "NO" });
    expect(sold.amount).toBeCloseTo(42, 3);
    expect(wallets.get("u0")!.balance).toBeCloseTo(start, 3);
    expect(market.positions[0].sharesNo).toBeCloseTo(0, 6);
    expect(sold.realizedPnl).toBeCloseTo(0, 3);
  });

  it("rejects a bet larger than the balance and a sale larger than the position", () => {
    const market = createBinaryMarket("m", 100, 0.5);
    const wallets = desk([30]);
    expect(() => buy(market, wallets.get("u0")!, { amount: 40, outcome: "YES" })).toThrow(TradeError);
    buy(market, wallets.get("u0")!, { amount: 20, outcome: "YES" });
    expect(() => sell(market, wallets.get("u0")!, { shares: 10_000, outcome: "NO" })).toThrow(/don't have shares/);
    const held = market.positions[0].sharesYes;
    const sold = sell(market, wallets.get("u0")!, { shares: held + 5, outcome: "YES" });
    expect(sold.shares).toBeCloseTo(held, 6);
  });

  it("quotes a fresh buy near the stake and moves a multi-choice answer", () => {
    const market = createMultiMarket("m", 300, [
      { id: "a", text: "Alpha", probability: 0.5 },
      { id: "b", text: "Beta", probability: 0.3 },
      { id: "c", text: "Gamma", probability: 0.2 },
    ]);
    const wallets = desk([1000]);
    const fill = buy(market, wallets.get("u0")!, { amount: 40, answerId: "b" });
    expect(fill.probAfter).toBeGreaterThan(0.3);
    expect(market.answers.find((answer) => answer.id === "a")!.probability).toBeLessThan(0.5);
    const quote = quoteHoldings(market, market.positions[0]);
    expect(quote).toBeCloseTo(40, 2);
    expect(market.answers.reduce((sum, answer) => sum + answer.probability, 0)).toBeCloseTo(1, 6);
  });

  it("sells part of a multiple-choice position", () => {
    const market = createMultiMarket("m", 220, [
      { id: "a", text: "Alpha" },
      { id: "b", text: "Beta" },
    ]);
    const wallets = desk([500]);
    const before = wealth(wallets, [market]);
    const fill = buy(market, wallets.get("u0")!, { amount: 60, answerId: "a" });
    const sold = sell(market, wallets.get("u0")!, { shares: fill.shares / 2, answerId: "a" });
    expect(sold.amount).toBeGreaterThan(0);
    expect(sold.amount).toBeLessThan(60);
    expect(market.positions[0].shares).toBeCloseTo(fill.shares / 2, 4);
    expect(wealth(wallets, [market])).toBeCloseTo(before, 4);
  });
});

describe("resolution", () => {
  it("pays YES holders, returns the residual to the creator, and conserves TP", () => {
    const market = createBinaryMarket("m", 100, 0.5);
    const wallets = desk([1000, 1000, 1000]);
    const before = wealth(wallets, [market]);
    buy(market, wallets.get("u1")!, { amount: 80, outcome: "YES" });
    buy(market, wallets.get("u2")!, { amount: 30, outcome: "NO" });
    const yesShares = market.positions.find((position) => position.userId === "u1")!.sharesYes;
    const result = resolveMarket(market, wallets, "u0", { resolution: "YES" });
    const yesCredit = result.credits.find((credit) => credit.userId === "u1" && credit.role === "trader");
    expect(yesCredit?.payout).toBeCloseTo(yesShares, 6);
    expect(market.resolution).toBe("YES");
    expect(market.pot).toBe(0);
    expect(market.probability).toBe(1);
    expect(() => buy(market, wallets.get("u1")!, { amount: 10, outcome: "NO" })).toThrow(/resolved/);
    expect(wealth(wallets, [market])).toBeCloseTo(before, 4);
  });

  it("splits a percentage resolution between YES and NO", () => {
    const market = createBinaryMarket("m", 150, 0.42);
    const wallets = desk([2000, 2000]);
    const before = wealth(wallets, [market]);
    buy(market, wallets.get("u0")!, { amount: 70, outcome: "YES" });
    buy(market, wallets.get("u1")!, { amount: 40, outcome: "NO" });
    const yes = market.positions.find((position) => position.userId === "u0")!;
    const no = market.positions.find((position) => position.userId === "u1")!;
    const yesShares = yes.sharesYes;
    const noShares = no.sharesNo;
    resolveMarket(market, wallets, "u0", { resolution: "MKT", probability: 0.25 });
    expect(yes.payout).toBeCloseTo(yesShares * 0.25, 6);
    expect(no.payout).toBeCloseTo(noShares * 0.75, 6);
    expect(wealth(wallets, [market])).toBeCloseTo(before, 4);
  });

  it("cancels a market and returns net stakes, including a profitable sale", () => {
    const market = createBinaryMarket("m", 120, 0.5);
    const wallets = desk([3000, 3000]);
    const creatorStart = wallets.get("u0")!.balance;
    wallets.get("u0")!.balance -= market.ante;
    const before = wealth(wallets, [market]);
    const traderStart = 3000;
    buy(market, wallets.get("u1")!, { amount: 100, outcome: "YES" });
    const shares = market.positions[0].sharesYes;
    sell(market, wallets.get("u1")!, { shares, outcome: "YES" });
    resolveMarket(market, wallets, "u0", { resolution: "CANCEL" });
    expect(wallets.get("u0")!.balance).toBeCloseTo(creatorStart, 3);
    expect(wallets.get("u1")!.balance).toBeCloseTo(traderStart, 3);
    expect(market.pot).toBe(0);
    expect(wealth(wallets, [market])).toBeCloseTo(before, 3);
  });

  it("settles a multiple-choice winner and a weighted split", () => {
    const build = () => {
      const market = createMultiMarket("m", 200, [
        { id: "a", text: "Alpha" },
        { id: "b", text: "Beta" },
        { id: "c", text: "Gamma" },
      ]);
      const wallets = desk([1500, 1500, 1500]);
      buy(market, wallets.get("u1")!, { amount: 50, answerId: "a" });
      buy(market, wallets.get("u2")!, { amount: 35, answerId: "c" });
      return { market, wallets, before: wealth(wallets, [market]) };
    };

    const winner = build();
    const shares = winner.market.positions.find((position) => position.userId === "u1")!.shares;
    resolveMarket(winner.market, winner.wallets, "u0", { resolution: "ANSWER", answerId: "a" });
    expect(winner.market.positions.find((position) => position.userId === "u1")!.payout).toBeCloseTo(shares, 5);
    expect(winner.market.positions.find((position) => position.userId === "u2")!.payout).toBeCloseTo(0, 6);
    expect(winner.market.answers.find((answer) => answer.id === "a")!.probability).toBe(1);
    expect(wealth(winner.wallets, [winner.market])).toBeCloseTo(winner.before, 4);

    const split = build();
    resolveMarket(split.market, split.wallets, "u0", {
      resolution: "MKT_MULTI",
      weights: { a: 20, b: 50, c: 30 },
    });
    const alpha = split.market.positions.find((position) => position.answerId === "a")!;
    const gamma = split.market.positions.find((position) => position.answerId === "c")!;
    expect(alpha.payout).toBeGreaterThan(0);
    expect(gamma.payout).toBeGreaterThan(0);
    expect(alpha.payout / (alpha.payout + gamma.payout)).toBeGreaterThan(0);
    expect(wealth(split.wallets, [split.market])).toBeCloseTo(split.before, 4);
  });

  it("conserves TP across a random session of buys, sells, and a resolution", () => {
    const rand = mulberry32(7);
    const resolutions = ["YES", "NO", "MKT", "CANCEL"] as const;
    for (const resolution of resolutions) {
      const market = createBinaryMarket("m", 250, 0.2 + rand() * 0.6);
      const wallets = desk([5000, 5000, 5000, 5000]);
      const before = wealth(wallets, [market]);
      for (let step = 0; step < 40; step++) {
        const id = `u${1 + Math.floor(rand() * 3)}`;
        const wallet = wallets.get(id)!;
        const outcome = rand() < 0.5 ? "YES" : "NO";
        const held = market.positions.find((position) => position.userId === id);
        const sideShares = outcome === "YES" ? held?.sharesYes ?? 0 : held?.sharesNo ?? 0;
        try {
          if (rand() < 0.3 && sideShares > 1) {
            sell(market, wallet, { shares: sideShares * (0.2 + rand() * 0.6), outcome });
          } else if (wallet.balance > 5) {
            buy(market, wallet, { amount: Math.min(wallet.balance, 5 + rand() * 80), outcome });
          }
        } catch (error) {
          if (!(error instanceof TradeError)) throw error;
        }
        expect(wealth(wallets, [market])).toBeCloseTo(before, 3);
        expect(market.pot).toBeGreaterThan(-1e-6);
      }
      if (resolution === "MKT") {
        resolveMarket(market, wallets, "u0", { resolution, probability: rand() });
      } else {
        resolveMarket(market, wallets, "u0", { resolution });
      }
      expect(market.pot).toBeCloseTo(0, 4);
      expect(wealth(wallets, [market])).toBeCloseTo(before, 2);
    }
  });

  it("conserves TP across a random multiple-choice session", () => {
    const rand = mulberry32(19);
    const market = createMultiMarket("m", 400, [
      { id: "a", text: "Alpha", probability: 0.4 },
      { id: "b", text: "Beta", probability: 0.35 },
      { id: "c", text: "Gamma", probability: 0.25 },
    ]);
    const wallets = desk([8000, 8000, 8000, 8000]);
    const before = wealth(wallets, [market]);
    const ids = ["a", "b", "c"];
    for (let step = 0; step < 50; step++) {
      const userId = `u${1 + Math.floor(rand() * 3)}`;
      const wallet = wallets.get(userId)!;
      const answerId = ids[Math.floor(rand() * ids.length)];
      const position = market.positions.find((item) => item.userId === userId && item.answerId === answerId);
      try {
        if (rand() < 0.28 && (position?.shares ?? 0) > 1) {
          sell(market, wallet, { shares: position!.shares * (0.25 + rand() * 0.5), answerId });
        } else if (wallet.balance > 5) {
          buy(market, wallet, { amount: Math.min(wallet.balance, 8 + rand() * 70), answerId });
        }
      } catch (error) {
        if (!(error instanceof TradeError)) throw error;
      }
      expect(market.answers.reduce((sum, answer) => sum + answer.probability, 0)).toBeCloseTo(1, 6);
      expect(wealth(wallets, [market])).toBeCloseTo(before, 3);
    }
    resolveMarket(market, wallets, "u0", { resolution: "ANSWER", answerId: "b" });
    expect(wealth(wallets, [market])).toBeCloseTo(before, 2);
  });
});
