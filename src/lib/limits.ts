import { binaryProbability, buyBinary, type BinaryPool } from "./cpmm";
import { buy, type LedgerMarket, type TradeFill, type Wallet } from "./ledger";

export type LimitOrderState = {
  id: string;
  userId: string;
  outcome: "YES" | "NO";
  /** Highest price, in probability, the trader will pay for this outcome. */
  limitProb: number;
  remaining: number;
  status: "OPEN" | "FILLED" | "CANCELLED";
  createdAt: number;
};

export function outcomePrice(probability: number, outcome: "YES" | "NO"): number {
  return outcome === "YES" ? probability : 1 - probability;
}

export function limitIsCrossing(probability: number, order: Pick<LimitOrderState, "outcome" | "limitProb" | "status" | "remaining">): boolean {
  if (order.status !== "OPEN" || order.remaining < 1) return false;
  return outcomePrice(probability, order.outcome) < order.limitProb - 1e-8;
}

/**
 * Largest stake, at least 1 TP and at most `budget`, that buys `outcome`
 * without pushing its price above `limitProb`. Returns 0 when the order
 * should keep resting.
 */
export function stakeWithinLimit(pool: BinaryPool, outcome: "YES" | "NO", limitProb: number, budget: number): number {
  if (!(budget >= 1) || !(limitProb > 0) || !(limitProb < 1)) return 0;
  const start = binaryProbability(pool);
  if (outcomePrice(start, outcome) >= limitProb - 1e-8) return 0;

  const within = (amount: number) => {
    const trade = buyBinary(pool, outcome, amount);
    return outcomePrice(trade.probAfter, outcome) <= limitProb + 1e-6;
  };

  if (within(budget)) return budget;

  let lo = 0;
  let hi = budget;
  for (let step = 0; step < 48; step++) {
    const mid = (lo + hi) / 2;
    try {
      if (mid >= 1 && within(mid)) lo = mid;
      else hi = mid;
    } catch {
      hi = mid;
    }
  }
  return lo >= 1 ? lo : 0;
}

/**
 * Fill resting binary limit orders that the current price already crosses.
 * Escrowed funds sit outside the wallet: each fill returns the spent slice
 * to the wallet and then runs a normal buy, so balances stay consistent.
 */
export function fillLimitOrders(market: LedgerMarket, wallets: Map<string, Wallet>, orders: LimitOrderState[]): TradeFill[] {
  if (market.type !== "BINARY" || market.resolution) return [];
  const fills: TradeFill[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const crossing = orders
      .filter((order) => limitIsCrossing(market.probability, order))
      .sort((a, b) => b.limitProb - a.limitProb || a.createdAt - b.createdAt);
    const order = crossing[0];
    if (!order) break;
    const wallet = wallets.get(order.userId);
    if (!wallet) break;
    const spend = stakeWithinLimit(
      { yes: market.poolYes, no: market.poolNo, p: market.p },
      order.outcome,
      order.limitProb,
      order.remaining,
    );
    if (spend < 1) break;
    wallet.balance += spend;
    const fill = buy(market, wallet, { amount: spend, outcome: order.outcome });
    order.remaining = Math.max(0, order.remaining - spend);
    if (order.remaining < 1) {
      wallet.balance += order.remaining;
      order.remaining = 0;
      order.status = "FILLED";
    }
    fills.push(fill);
  }
  return fills;
}

export function cancelLimitOrder(order: LimitOrderState, wallet: Wallet): number {
  if (order.status !== "OPEN") return 0;
  const refund = Math.max(0, order.remaining);
  wallet.balance += refund;
  order.remaining = 0;
  order.status = "CANCELLED";
  return refund;
}
