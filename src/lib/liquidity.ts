import { binaryProbability, type BinaryPool } from "./cpmm";

/** Scale every reserve by the same factor so the price is unchanged. */
export function subsidizeBinary(pool: BinaryPool, amount: number): BinaryPool {
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Subsidy must be positive");
  const depth = (pool.yes + pool.no) / 2;
  if (!(depth > 0)) throw new Error("Pool is empty");
  const scale = 1 + amount / depth;
  return { yes: pool.yes * scale, no: pool.no * scale, p: pool.p };
}

export function subsidizeMulti(pools: number[], amount: number): number[] {
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error("Subsidy must be positive");
  if (pools.length < 2 || pools.some((pool) => !(pool > 0))) throw new Error("Pool is empty");
  const depth = pools.reduce((sum, pool) => sum + pool, 0) / pools.length;
  const scale = 1 + amount / depth;
  return pools.map((pool) => pool * scale);
}

export function binaryDepth(pool: BinaryPool): number {
  return (pool.yes + pool.no) / 2;
}

export function probabilityUnchanged(before: BinaryPool, after: BinaryPool): boolean {
  return Math.abs(binaryProbability(before) - binaryProbability(after)) < 1e-12;
}
