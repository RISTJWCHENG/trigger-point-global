/**
 * Constant-product market maker used by TriggerPointGlobal.
 *
 * Binary markets follow Manifold's CPMM-1: pool invariant
 *   YES^p * NO^(1-p) = k
 * with probability
 *   (p * NO) / ((1-p) * YES + p * NO).
 * A purchase mints a complete set (adds the stake to both sides) and
 * then removes shares from the side being bought.
 *
 * Multiple-choice markets use a fixed-product market maker across
 * outcome reserves. Price of outcome i is
 *   (1 / pool_i) / Σ(1 / pool_j).
 * Buying outcome i adds the stake to every other reserve and removes
 * shares from reserve i. Pools are initialized so the requested
 * probabilities are exact and every outcome stays collateralized.
 */

export type BinaryPool = {
  yes: number;
  no: number;
  /** CPMM weight, fixed at creation. Equals the initial probability. */
  p: number;
};

export type MultiPool = {
  pools: number[];
};

/** Initial weights stay inside a range the closed form can evaluate stably. */
export function clampProb(prob: number): number {
  if (!Number.isFinite(prob)) return 0.5;
  return Math.min(0.99, Math.max(0.01, prob));
}

export function binaryProbability(pool: BinaryPool): number {
  const { yes, no, p } = pool;
  const denom = (1 - p) * yes + p * no;
  if (!(denom > 0) || !Number.isFinite(denom)) return p;
  const prob = (p * no) / denom;
  if (!Number.isFinite(prob)) return p;
  return Math.min(1 - 1e-12, Math.max(1e-12, prob));
}

export function initialBinaryPool(ante: number, prob: number): BinaryPool {
  if (!(ante > 0)) throw new Error("Liquidity must be positive");
  const p = clampProb(prob);
  return { yes: ante, no: ante, p };
}

export type BinaryTrade = {
  pool: BinaryPool;
  shares: number;
  probBefore: number;
  probAfter: number;
};

function assertFinitePool(pool: BinaryPool) {
  if (!(pool.yes > 0) || !(pool.no > 0) || !Number.isFinite(pool.yes) || !Number.isFinite(pool.no)) {
    throw new Error("Pool would be depleted");
  }
}

/**
 * Shares received for spending `bet` on one side, before the pool is updated.
 * Closed form from (y + b - s)^p * (n + b)^(1-p) = y^p * n^(1-p).
 */
export function calculateBinaryShares(pool: BinaryPool, outcome: "YES" | "NO", bet: number): number {
  if (bet === 0) return 0;
  const { yes: y, no: n, p } = pool;
  const k = y ** p * n ** (1 - p);
  const shares =
    outcome === "YES"
      ? y + bet - (k * (bet + n) ** (p - 1)) ** (1 / p)
      : n + bet - (k * (bet + y) ** -p) ** (1 / (1 - p));
  return shares;
}

export function buyBinary(pool: BinaryPool, outcome: "YES" | "NO", bet: number): BinaryTrade {
  if (!(bet > 0) || !Number.isFinite(bet)) throw new Error("Bet must be positive");
  const probBefore = binaryProbability(pool);
  const shares = calculateBinaryShares(pool, outcome, bet);
  if (!Number.isFinite(shares) || !(shares > 0)) {
    throw new Error("Trade is too small for this pool");
  }

  const newPool: BinaryPool =
    outcome === "YES"
      ? { yes: pool.yes + bet - shares, no: pool.no + bet, p: pool.p }
      : { yes: pool.yes + bet, no: pool.no + bet - shares, p: pool.p };
  assertFinitePool(newPool);
  const probAfter = binaryProbability(newPool);
  if (outcome === "YES" && probAfter + 1e-12 < probBefore) {
    throw new Error("Buy YES did not increase probability");
  }
  if (outcome === "NO" && probAfter - 1e-12 > probBefore) {
    throw new Error("Buy NO did not decrease probability");
  }
  return { pool: newPool, shares, probBefore, probAfter };
}

/**
 * Cash required to receive exactly `targetShares` of `outcome`.
 * Shares rise monotonically in the stake, and a stake of S always
 * buys more than S shares (average price is below 1).
 */
export function costToBuyShares(pool: BinaryPool, outcome: "YES" | "NO", targetShares: number): number {
  if (targetShares <= 0) return 0;
  if (!Number.isFinite(targetShares)) throw new Error("Invalid share amount");

  const sharesFor = (bet: number) => calculateBinaryShares(pool, outcome, bet);

  let hi = Math.max(targetShares, 1e-8);
  let produced = sharesFor(hi);
  for (let i = 0; i < 40 && !(produced >= targetShares); i++) {
    hi *= 2;
    produced = sharesFor(hi);
    if (!Number.isFinite(produced)) throw new Error("Cannot price this sale");
  }
  if (!(produced >= targetShares)) throw new Error("Not enough liquidity to price this sale");

  let lo = 0;
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (sharesFor(mid) < targetShares) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type BinarySale = BinaryTrade & { proceeds: number };

/**
 * Selling shares is the inverse of buying them: pay for the same number
 * of opposite shares, merge the pair into cash, and keep the difference.
 * Merging means the opposite shares never enter the user's position.
 */
export function sellBinary(pool: BinaryPool, outcome: "YES" | "NO", shares: number): BinarySale {
  if (!(shares > 0) || !Number.isFinite(shares)) throw new Error("Shares must be positive");
  const opposite = outcome === "YES" ? "NO" : "YES";
  const cost = costToBuyShares(pool, opposite, shares);
  const bought = buyBinary(pool, opposite, cost);
  const proceeds = shares - cost;
  if (!Number.isFinite(proceeds) || proceeds < -1e-8) {
    throw new Error("Sale has no value");
  }
  return {
    pool: bought.pool,
    shares,
    proceeds: Math.max(0, proceeds),
    probBefore: bought.probBefore,
    probAfter: bought.probAfter,
  };
}

export function multiProbabilities(pools: number[]): number[] {
  if (pools.length < 2) throw new Error("Need at least two outcomes");
  if (pools.some((pool) => !(pool > 0) || !Number.isFinite(pool))) {
    throw new Error("Invalid outcome pool");
  }
  const inv = pools.map((pool) => 1 / pool);
  const sum = inv.reduce((total, value) => total + value, 0);
  return inv.map((value) => value / sum);
}

/**
 * Reserves are ante * min(p) / p_i. The least likely outcome is fully
 * funded by the ante, and every other reserve is smaller, so
 * outstanding shares of each outcome stay within collateral.
 */
export function initialMultiPool(ante: number, probabilities: number[]): MultiPool {
  if (!(ante > 0)) throw new Error("Liquidity must be positive");
  if (probabilities.length < 2) throw new Error("Need at least two answers");
  const raw = probabilities.map((prob) => Math.max(prob, 0));
  const total = raw.reduce((sum, prob) => sum + prob, 0);
  if (!(total > 0)) throw new Error("Probabilities must sum to a positive number");
  const normalized = raw.map((prob) => Math.max(prob / total, 1e-6));
  const renorm = normalized.reduce((sum, prob) => sum + prob, 0);
  const probs = normalized.map((prob) => prob / renorm);
  const minP = Math.min(...probs);
  return { pools: probs.map((prob) => (ante * minP) / prob) };
}

export type MultiTrade = {
  pool: MultiPool;
  shares: number;
  probsBefore: number[];
  probsAfter: number[];
};

export function buyMulti(pool: MultiPool, index: number, bet: number): MultiTrade {
  if (!(bet > 0) || !Number.isFinite(bet)) throw new Error("Bet must be positive");
  if (index < 0 || index >= pool.pools.length) throw new Error("Unknown answer");
  const probsBefore = multiProbabilities(pool.pools);
  let ending = pool.pools[index];
  for (let other = 0; other < pool.pools.length; other++) {
    if (other === index) continue;
    ending *= pool.pools[other] / (pool.pools[other] + bet);
  }
  const shares = pool.pools[index] + bet - ending;
  if (!Number.isFinite(shares) || !(shares > 0) || !(ending > 0)) {
    throw new Error("Trade is too small for this pool");
  }
  const pools = pool.pools.map((reserve, other) => (other === index ? ending : reserve + bet));
  const probsAfter = multiProbabilities(pools);
  if (!(probsAfter[index] + 1e-12 >= probsBefore[index])) {
    throw new Error("Buying an answer did not raise its probability");
  }
  return { pool: { pools }, shares, probsBefore, probsAfter };
}

function sharesSoldForProceeds(pools: number[], index: number, proceeds: number): number {
  let rebuilt = pools[index];
  for (let other = 0; other < pools.length; other++) {
    if (other === index) continue;
    const next = pools[other] - proceeds;
    if (!(next > 0)) return Number.POSITIVE_INFINITY;
    rebuilt *= pools[other] / next;
  }
  return rebuilt - pools[index] + proceeds;
}

export type MultiSale = MultiTrade & { proceeds: number };

export function sellMulti(pool: MultiPool, index: number, shares: number): MultiSale {
  if (!(shares > 0) || !Number.isFinite(shares)) throw new Error("Shares must be positive");
  if (index < 0 || index >= pool.pools.length) throw new Error("Unknown answer");
  const others = pool.pools.filter((_, other) => other !== index);
  const maxProceeds = Math.min(...others) * (1 - 1e-9);
  if (!(maxProceeds > 0)) throw new Error("Not enough liquidity to sell");
  const atMax = sharesSoldForProceeds(pool.pools, index, maxProceeds);
  if (atMax + 1e-6 < shares) throw new Error("Not enough liquidity to sell this many shares");

  let lo = 0;
  let hi = maxProceeds;
  for (let step = 0; step < 80; step++) {
    const mid = (lo + hi) / 2;
    if (sharesSoldForProceeds(pool.pools, index, mid) < shares) lo = mid;
    else hi = mid;
  }
  const proceeds = hi;
  let ending = pool.pools[index];
  const pools = pool.pools.map((reserve, other) => {
    if (other === index) return reserve;
    return reserve - proceeds;
  });
  for (let other = 0; other < pool.pools.length; other++) {
    if (other === index) continue;
    ending *= pool.pools[other] / pools[other];
  }
  pools[index] = ending;
  if (pools.some((reserve) => !(reserve > 0) || !Number.isFinite(reserve))) {
    throw new Error("Sale would deplete the pool");
  }
  return {
    pool: { pools },
    shares,
    proceeds,
    probsBefore: multiProbabilities(pool.pools),
    probsAfter: multiProbabilities(pools),
  };
}

export function binaryPayouts(resolution: "YES" | "NO" | "MKT", probability: number): { yes: number; no: number } {
  if (resolution === "YES") return { yes: 1, no: 0 };
  if (resolution === "NO") return { yes: 0, no: 1 };
  const p = Math.min(1, Math.max(0, probability));
  return { yes: p, no: 1 - p };
}

export function quoteBinarySell(pool: BinaryPool, outcome: "YES" | "NO", shares: number): number {
  if (!(shares > 1e-8)) return 0;
  try {
    return Math.max(0, sellBinary(pool, outcome, shares).proceeds);
  } catch {
    const prob = binaryProbability(pool);
    return shares * (outcome === "YES" ? prob : 1 - prob);
  }
}

export function quoteMultiSell(pool: MultiPool, index: number, shares: number): number {
  if (!(shares > 1e-8)) return 0;
  try {
    return Math.max(0, sellMulti(pool, index, shares).proceeds);
  } catch {
    const probs = multiProbabilities(pool.pools);
    return shares * (probs[index] ?? 0);
  }
}

export function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

export function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
