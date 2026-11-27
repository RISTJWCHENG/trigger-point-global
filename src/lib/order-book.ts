export type RestingOrder = {
  outcome: "YES" | "NO" | string;
  limitProb: number;
  remaining: number;
};

export type BookLevel = { limitProb: number; amount: number };

export function aggregateOrderBook(orders: RestingOrder[]) {
  const levels = (outcome: "YES" | "NO"): BookLevel[] => {
    const totals = new Map<number, number>();
    for (const order of orders) {
      if (order.outcome !== outcome || !(order.remaining > 0)) continue;
      const price = Math.round(order.limitProb * 1000) / 1000;
      totals.set(price, (totals.get(price) ?? 0) + order.remaining);
    }
    return [...totals.entries()]
      .map(([limitProb, amount]) => ({ limitProb, amount }))
      .sort((a, b) => b.limitProb - a.limitProb);
  };
  return { yes: levels("YES"), no: levels("NO") };
}
