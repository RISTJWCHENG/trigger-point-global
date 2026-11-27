export type PublicBet = {
  outcome: string;
  side: string;
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  createdTime: string;
  username: string;
};

export type PublicMarket = {
  id: string;
  slug: string;
  question: string;
  description: string;
  type: string;
  topic: string;
  probability: number;
  pool: { YES: number; NO: number; p: number };
  liquidity: number;
  volume: number;
  closeTime: string;
  createdTime: string;
  isResolved: boolean;
  resolution: string | null;
  answers: { id: string; text: string; probability: number; pool: number }[];
  bets?: PublicBet[];
};

export function toPublicMarket(
  market: {
    id: string;
    slug: string;
    question: string;
    description: string;
    type: string;
    topic: string;
    probability: number;
    poolYes: number;
    poolNo: number;
    p: number;
    liquidity: number;
    volume: number;
    closeAt: Date;
    createdAt: Date;
    resolution: string | null;
    answers: { id: string; text: string; probability: number; pool: number }[];
    trades?: { outcome: string; side: string; amount: number; shares: number; probBefore: number; probAfter: number; createdAt: Date; user: { username: string } }[];
  },
  includeBets = false,
): PublicMarket {
  const payload: PublicMarket = {
    id: market.id,
    slug: market.slug,
    question: market.question,
    description: market.description,
    type: market.type,
    topic: market.topic,
    probability: market.probability,
    pool: { YES: market.poolYes, NO: market.poolNo, p: market.p },
    liquidity: market.liquidity,
    volume: market.volume,
    closeTime: market.closeAt.toISOString(),
    createdTime: market.createdAt.toISOString(),
    isResolved: Boolean(market.resolution),
    resolution: market.resolution,
    answers: [...market.answers].map((answer) => ({
      id: answer.id,
      text: answer.text,
      probability: answer.probability,
      pool: answer.pool,
    })),
  };
  if (includeBets) {
    payload.bets = (market.trades ?? []).map((trade) => ({
      outcome: trade.outcome,
      side: trade.side,
      amount: trade.amount,
      shares: trade.shares,
      probBefore: trade.probBefore,
      probAfter: trade.probAfter,
      createdTime: trade.createdAt.toISOString(),
      username: trade.user.username,
    }));
  }
  return payload;
}

export function toPublicUser(user: {
  id: string;
  username: string;
  name: string;
  bio: string;
  createdAt: Date;
  balance: number;
  followerCount: number;
  followingCount: number;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    createdTime: user.createdAt.toISOString(),
    balance: user.balance,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
  };
}
