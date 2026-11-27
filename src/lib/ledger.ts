import {
  binaryPayouts,
  binaryProbability,
  buyBinary,
  buyMulti,
  initialBinaryPool,
  initialMultiPool,
  multiProbabilities,
  quoteBinarySell,
  quoteMultiSell,
  sellBinary,
  sellMulti,
} from "./cpmm";
import { TradeError } from "./errors";

export type LedgerAnswer = {
  id: string;
  text: string;
  pool: number;
  probability: number;
};

export type LedgerPosition = {
  userId: string;
  answerId: string;
  sharesYes: number;
  sharesNo: number;
  shares: number;
  invested: number;
  costBasisYes: number;
  costBasisNo: number;
  realizedPnl: number;
  payout: number;
};

export type LedgerMarket = {
  id: string;
  type: "BINARY" | "MULTIPLE";
  poolYes: number;
  poolNo: number;
  p: number;
  probability: number;
  pot: number;
  ante: number;
  volume: number;
  traderIds: string[];
  resolution: string | null;
  resolutionProb: number | null;
  answers: LedgerAnswer[];
  positions: LedgerPosition[];
};

export type Wallet = { id: string; balance: number };

export type TradeFill = {
  userId: string;
  answerId: string;
  outcome: string;
  side: "BUY" | "SELL";
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  realizedPnl: number;
  snapshot: string;
};

export type PnlFill = { userId: string; amount: number };

function emptyPosition(userId: string, answerId: string): LedgerPosition {
  return {
    userId,
    answerId,
    sharesYes: 0,
    sharesNo: 0,
    shares: 0,
    invested: 0,
    costBasisYes: 0,
    costBasisNo: 0,
    realizedPnl: 0,
    payout: 0,
  };
}

function positionFor(market: LedgerMarket, userId: string, answerId: string): LedgerPosition {
  const found = market.positions.find((position) => position.userId === userId && position.answerId === answerId);
  if (found) return found;
  const created = emptyPosition(userId, answerId);
  market.positions.push(created);
  return created;
}

function noteTrader(market: LedgerMarket, userId: string) {
  if (!market.traderIds.includes(userId)) market.traderIds.push(userId);
}

export function marketSnapshot(market: LedgerMarket): string {
  if (market.type === "BINARY") return JSON.stringify({ YES: market.probability });
  return JSON.stringify(Object.fromEntries(market.answers.map((answer) => [answer.id, answer.probability])));
}

function assertOpen(market: LedgerMarket) {
  if (market.resolution) throw new TradeError("This market is already resolved");
}

function syncMultiProbability(market: LedgerMarket) {
  const probs = multiProbabilities(market.answers.map((answer) => answer.pool));
  market.answers.forEach((answer, index) => {
    answer.probability = probs[index];
  });
  market.probability = Math.max(...probs);
}

export function createBinaryMarket(id: string, ante: number, probability: number): LedgerMarket {
  const pool = initialBinaryPool(ante, probability);
  const prob = binaryProbability(pool);
  return {
    id,
    type: "BINARY",
    poolYes: pool.yes,
    poolNo: pool.no,
    p: pool.p,
    probability: prob,
    pot: ante,
    ante,
    volume: 0,
    traderIds: [],
    resolution: null,
    resolutionProb: null,
    answers: [],
    positions: [],
  };
}

export function createMultiMarket(
  id: string,
  ante: number,
  answers: { id: string; text: string; probability?: number }[],
): LedgerMarket {
  if (answers.length < 2) throw new TradeError("Add at least two answers");
  if (answers.length > 8) throw new TradeError("A market can have at most 8 answers");
  const pool = initialMultiPool(
    ante,
    answers.map((answer) => answer.probability ?? 1),
  );
  const probs = multiProbabilities(pool.pools);
  return {
    id,
    type: "MULTIPLE",
    poolYes: 0,
    poolNo: 0,
    p: 0.5,
    probability: Math.max(...probs),
    pot: ante,
    ante,
    volume: 0,
    traderIds: [],
    resolution: null,
    resolutionProb: null,
    answers: answers.map((answer, index) => ({
      id: answer.id,
      text: answer.text.trim(),
      pool: pool.pools[index],
      probability: probs[index],
    })),
    positions: [],
  };
}

export function buy(
  market: LedgerMarket,
  wallet: Wallet,
  input: { amount: number; outcome?: "YES" | "NO"; answerId?: string },
): TradeFill {
  assertOpen(market);
  const amount = input.amount;
  if (!Number.isFinite(amount) || amount < 1) throw new TradeError("Minimum bet is 1 TP");
  if (wallet.balance + 1e-8 < amount) throw new TradeError("Not enough TP in your balance");

  if (market.type === "BINARY") {
    const outcome = input.outcome;
    if (outcome !== "YES" && outcome !== "NO") throw new TradeError("Choose YES or NO");
    let trade;
    try {
      trade = buyBinary({ yes: market.poolYes, no: market.poolNo, p: market.p }, outcome, amount);
    } catch {
      throw new TradeError("That bet can't be priced against the current pool");
    }
    market.poolYes = trade.pool.yes;
    market.poolNo = trade.pool.no;
    market.probability = trade.probAfter;
    const position = positionFor(market, wallet.id, "");
    if (outcome === "YES") {
      position.sharesYes += trade.shares;
      position.costBasisYes += amount;
    } else {
      position.sharesNo += trade.shares;
      position.costBasisNo += amount;
    }
    position.invested += amount;
    wallet.balance -= amount;
    market.pot += amount;
    market.volume += amount;
    noteTrader(market, wallet.id);
    return {
      userId: wallet.id,
      answerId: "",
      outcome,
      side: "BUY",
      amount,
      shares: trade.shares,
      probBefore: trade.probBefore,
      probAfter: trade.probAfter,
      realizedPnl: 0,
      snapshot: marketSnapshot(market),
    };
  }

  const index = market.answers.findIndex((answer) => answer.id === input.answerId);
  if (index < 0) throw new TradeError("Choose an answer");
  let trade;
  try {
    trade = buyMulti({ pools: market.answers.map((answer) => answer.pool) }, index, amount);
  } catch {
    throw new TradeError("That bet can't be priced against the current pool");
  }
  market.answers.forEach((answer, answerIndex) => {
    answer.pool = trade.pool.pools[answerIndex];
  });
  syncMultiProbability(market);
  const position = positionFor(market, wallet.id, market.answers[index].id);
  position.shares += trade.shares;
  position.costBasisYes += amount;
  position.invested += amount;
  wallet.balance -= amount;
  market.pot += amount;
  market.volume += amount;
  noteTrader(market, wallet.id);
  return {
    userId: wallet.id,
    answerId: market.answers[index].id,
    outcome: market.answers[index].text,
    side: "BUY",
    amount,
    shares: trade.shares,
    probBefore: trade.probsBefore[index],
    probAfter: trade.probsAfter[index],
    realizedPnl: 0,
    snapshot: marketSnapshot(market),
  };
}

export function sell(
  market: LedgerMarket,
  wallet: Wallet,
  input: { shares: number; outcome?: "YES" | "NO"; answerId?: string },
): TradeFill {
  assertOpen(market);
  const requested = input.shares;
  if (!Number.isFinite(requested) || requested <= 0) throw new TradeError("Enter how many shares to sell");

  if (market.type === "BINARY") {
    const outcome = input.outcome;
    if (outcome !== "YES" && outcome !== "NO") throw new TradeError("Choose YES or NO");
    const position = positionFor(market, wallet.id, "");
    const held = outcome === "YES" ? position.sharesYes : position.sharesNo;
    if (held <= 1e-8) throw new TradeError("You don't have shares on that side");
    const shares = requested > held - 1e-6 ? held : requested;
    let sale;
    try {
      sale = sellBinary({ yes: market.poolYes, no: market.poolNo, p: market.p }, outcome, shares);
    } catch {
      throw new TradeError("There isn't enough liquidity to sell that many shares");
    }
    if (!(sale.proceeds > 0)) throw new TradeError("That sale is too small to fill");
    const basis = outcome === "YES" ? position.costBasisYes : position.costBasisNo;
    const avg = held > 0 ? basis / held : 0;
    const soldBasis = avg * shares;
    const realized = sale.proceeds - soldBasis;
    if (outcome === "YES") {
      position.sharesYes = held - shares;
      position.costBasisYes = Math.max(0, basis - soldBasis);
    } else {
      position.sharesNo = held - shares;
      position.costBasisNo = Math.max(0, basis - soldBasis);
    }
    position.invested -= sale.proceeds;
    position.realizedPnl += realized;
    market.poolYes = sale.pool.yes;
    market.poolNo = sale.pool.no;
    market.probability = sale.probAfter;
    wallet.balance += sale.proceeds;
    market.pot -= sale.proceeds;
    market.volume += sale.proceeds;
    if (market.pot < -1e-4) throw new TradeError("Sale would overdraw the market");
    noteTrader(market, wallet.id);
    return {
      userId: wallet.id,
      answerId: "",
      outcome,
      side: "SELL",
      amount: sale.proceeds,
      shares,
      probBefore: sale.probBefore,
      probAfter: sale.probAfter,
      realizedPnl: realized,
      snapshot: marketSnapshot(market),
    };
  }

  const index = market.answers.findIndex((answer) => answer.id === input.answerId);
  if (index < 0) throw new TradeError("Choose an answer");
  const answer = market.answers[index];
  const position = positionFor(market, wallet.id, answer.id);
  if (position.shares <= 1e-8) throw new TradeError("You don't have shares of that answer");
  const shares = requested > position.shares - 1e-6 ? position.shares : requested;
  let sale;
  try {
    sale = sellMulti({ pools: market.answers.map((item) => item.pool) }, index, shares);
  } catch {
    throw new TradeError("There isn't enough liquidity to sell that many shares");
  }
  if (!(sale.proceeds > 0)) throw new TradeError("That sale is too small to fill");
  const avg = position.shares > 0 ? position.costBasisYes / position.shares : 0;
  const soldBasis = avg * shares;
  const realized = sale.proceeds - soldBasis;
  position.shares -= shares;
  position.costBasisYes = Math.max(0, position.costBasisYes - soldBasis);
  position.invested -= sale.proceeds;
  position.realizedPnl += realized;
  market.answers.forEach((item, answerIndex) => {
    item.pool = sale.pool.pools[answerIndex];
  });
  syncMultiProbability(market);
  wallet.balance += sale.proceeds;
  market.pot -= sale.proceeds;
  market.volume += sale.proceeds;
  if (market.pot < -1e-4) throw new TradeError("Sale would overdraw the market");
  noteTrader(market, wallet.id);
  return {
    userId: wallet.id,
    answerId: answer.id,
    outcome: answer.text,
    side: "SELL",
    amount: sale.proceeds,
    shares,
    probBefore: sale.probsBefore[index],
    probAfter: sale.probsAfter[index],
    realizedPnl: realized,
    snapshot: marketSnapshot(market),
  };
}

export type ResolveInput =
  | { resolution: "YES" | "NO" | "CANCEL"; note?: string }
  | { resolution: "MKT"; probability: number; note?: string }
  | { resolution: "ANSWER"; answerId: string; note?: string }
  | { resolution: "MKT_MULTI"; weights: Record<string, number>; note?: string };

export type ResolutionCredit = {
  userId: string;
  payout: number;
  pnl: number;
  role: "trader" | "creator";
};

export function resolveMarket(
  market: LedgerMarket,
  wallets: Map<string, Wallet>,
  creatorId: string,
  input: ResolveInput,
): { credits: ResolutionCredit[]; pnl: PnlFill[]; probability: number } {
  assertOpen(market);
  const creator = wallets.get(creatorId);
  if (!creator) throw new TradeError("Creator wallet is missing", 500);

  if (input.resolution === "CANCEL") {
    return cancelMarket(market, wallets, creator);
  }

  const weights = new Map<string, number>();
  let shown = market.probability;

  if (market.type === "BINARY") {
    if (input.resolution === "ANSWER" || input.resolution === "MKT_MULTI") {
      throw new TradeError("That resolution doesn't apply to a binary market");
    }
    const probability = input.resolution === "MKT" ? input.probability : input.resolution === "YES" ? 1 : 0;
    if (input.resolution === "MKT" && (!Number.isFinite(probability) || probability < 0 || probability > 1)) {
      throw new TradeError("Enter a resolution probability between 0 and 100");
    }
    const rate = binaryPayouts(input.resolution === "MKT" ? "MKT" : input.resolution, probability);
    weights.set("YES", rate.yes);
    weights.set("NO", rate.no);
    shown = input.resolution === "YES" ? 1 : input.resolution === "NO" ? 0 : probability;
    market.resolutionProb = input.resolution === "MKT" ? probability : null;
  } else {
    if (input.resolution === "YES" || input.resolution === "NO" || input.resolution === "MKT") {
      throw new TradeError("Choose a winning answer, a split, or cancel");
    }
    if (input.resolution === "ANSWER") {
      if (!market.answers.some((answer) => answer.id === input.answerId)) {
        throw new TradeError("Unknown answer");
      }
      for (const answer of market.answers) weights.set(answer.id, answer.id === input.answerId ? 1 : 0);
      shown = 1;
      market.resolutionProb = null;
    } else if (input.resolution === "MKT_MULTI") {
      const raw = market.answers.map((answer) => Math.max(0, input.weights[answer.id] ?? 0));
      const total = raw.reduce((sum, value) => sum + value, 0);
      if (!(total > 0)) throw new TradeError("Enter a split that sums to a positive amount");
      market.answers.forEach((answer, index) => {
        const weight = raw[index] / total;
        weights.set(answer.id, weight);
        answer.probability = weight;
      });
      shown = Math.max(...market.answers.map((answer) => answer.probability));
      market.resolutionProb = null;
    }
  }

  let paid = 0;
  const credits: ResolutionCredit[] = [];
  const pnl: PnlFill[] = [];

  for (const position of market.positions) {
    const wallet = wallets.get(position.userId);
    if (!wallet) throw new TradeError("Missing trader wallet", 500);
    let payout = 0;
    if (market.type === "BINARY") {
      payout = position.sharesYes * (weights.get("YES") ?? 0) + position.sharesNo * (weights.get("NO") ?? 0);
    } else {
      payout = position.shares * (weights.get(position.answerId) ?? 0);
    }
    const basis = position.costBasisYes + position.costBasisNo;
    const profit = payout - basis;
    wallet.balance += payout;
    paid += payout;
    position.payout += payout;
    position.realizedPnl += profit;
    position.sharesYes = 0;
    position.sharesNo = 0;
    position.shares = 0;
    position.costBasisYes = 0;
    position.costBasisNo = 0;
    position.invested = 0;
    if (Math.abs(payout) > 1e-10 || Math.abs(profit) > 1e-10) {
      credits.push({ userId: position.userId, payout, pnl: profit, role: "trader" });
      pnl.push({ userId: position.userId, amount: profit });
    }
  }

  const leftover = market.pot - paid;
  if (leftover < -0.05) throw new TradeError("Resolution payout exceeds the market pot", 500);
  const returned = Math.max(0, leftover);
  creator.balance += returned;
  credits.push({ userId: creatorId, payout: returned, pnl: returned - market.ante, role: "creator" });
  market.pot = 0;
  market.resolution =
    input.resolution === "ANSWER" ? input.answerId : input.resolution === "MKT_MULTI" ? "MKT" : input.resolution;
  market.probability = shown;
  if (market.type === "MULTIPLE" && input.resolution === "ANSWER") {
    market.answers.forEach((answer) => {
      answer.probability = answer.id === input.answerId ? 1 : 0;
    });
  }
  return { credits, pnl, probability: shown };
}

function cancelMarket(
  market: LedgerMarket,
  wallets: Map<string, Wallet>,
  creator: Wallet,
): { credits: ResolutionCredit[]; pnl: PnlFill[]; probability: number } {
  let refunded = 0;
  let clawed = 0;
  const credits: ResolutionCredit[] = [];
  const pnl: PnlFill[] = [];

  for (const position of market.positions) {
    const wallet = wallets.get(position.userId);
    if (!wallet) throw new TradeError("Missing trader wallet", 500);
    if (position.invested >= 0) {
      wallet.balance += position.invested;
      refunded += position.invested;
      if (position.invested > 1e-8) {
        credits.push({ userId: position.userId, payout: position.invested, pnl: -position.realizedPnl, role: "trader" });
      }
    } else {
      const owed = -position.invested;
      const pay = Math.min(Math.max(0, wallet.balance), owed);
      wallet.balance -= pay;
      clawed += pay;
      credits.push({ userId: position.userId, payout: -pay, pnl: -position.realizedPnl, role: "trader" });
    }
    if (Math.abs(position.realizedPnl) > 1e-8) {
      pnl.push({ userId: position.userId, amount: -position.realizedPnl });
    }
    position.realizedPnl = 0;
    position.sharesYes = 0;
    position.sharesNo = 0;
    position.shares = 0;
    position.costBasisYes = 0;
    position.costBasisNo = 0;
    position.invested = 0;
    position.payout = 0;
  }

  const creatorRefund = Math.max(0, market.pot - refunded + clawed);
  creator.balance += creatorRefund;
  credits.push({ userId: creator.id, payout: creatorRefund, pnl: creatorRefund - market.ante, role: "creator" });
  market.pot = 0;
  market.resolution = "CANCEL";
  return { credits, pnl, probability: market.probability };
}

export function quoteHoldings(market: LedgerMarket, position: LedgerPosition): number {
  if (market.resolution) return 0;
  if (market.type === "BINARY") {
    const pool = { yes: market.poolYes, no: market.poolNo, p: market.p };
    return quoteBinarySell(pool, "YES", position.sharesYes) + quoteBinarySell(pool, "NO", position.sharesNo);
  }
  const index = market.answers.findIndex((answer) => answer.id === position.answerId);
  if (index < 0) return 0;
  return quoteMultiSell({ pools: market.answers.map((answer) => answer.pool) }, index, position.shares);
}

export function totalWealth(wallets: Wallet[], markets: LedgerMarket[]): number {
  return (
    wallets.reduce((sum, wallet) => sum + wallet.balance, 0) +
    markets.reduce((sum, market) => sum + market.pot, 0)
  );
}
