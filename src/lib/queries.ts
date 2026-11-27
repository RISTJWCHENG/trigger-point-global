import { TOPICS } from "./constants";
import { prisma } from "./db";
import { quoteBinarySell, quoteMultiSell } from "./cpmm";
import { aggregateOrderBook } from "./order-book";
import { tallyPoll } from "./polls";
import type {
  AnswerView,
  CommentView,
  Creator,
  LeaderRow,
  MarketCard,
  MarketDetail,
  NotificationView,
  PortfolioData,
  PositionRow,
  RailTrade,
  TopicSummary,
  TradeHistoryRow,
} from "./types";

const creatorSelect = { username: true, name: true, avatarColor: true } as const;

type MarketRecord = {
  slug: string;
  question: string;
  type: string;
  topic: string;
  probability: number;
  volume: number;
  traderCount: number;
  closeAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  resolution: string | null;
  resolutionProb: number | null;
  creator: Creator;
  answers: { id: string; text: string; probability: number; pool: number; sortIndex: number }[];
  points?: { createdAt: Date; probability: number; snapshot: string }[];
  pollVotes?: { userId: string; answerId: string }[];
};

function asType(type: string): "BINARY" | "MULTIPLE" | "POLL" {
  if (type === "MULTIPLE") return "MULTIPLE";
  if (type === "POLL") return "POLL";
  return "BINARY";
}

function toCard(market: MarketRecord): MarketCard {
  const answers = [...market.answers].sort((a, b) => a.sortIndex - b.sortIndex);
  const tally =
    market.type === "POLL"
      ? tallyPoll(
          answers.map((answer) => answer.id),
          (market.pollVotes ?? []).map((vote) => ({ userId: vote.userId, answerId: vote.answerId })),
        )
      : null;
  return {
    slug: market.slug,
    question: market.question,
    type: asType(market.type),
    topic: market.topic,
    probability: tally && tally.total > 0 ? Math.max(...tally.shares.map((row) => row.share)) : market.probability,
    volume: market.volume,
    traders: market.traderCount,
    closeAt: market.closeAt.toISOString(),
    createdAt: market.createdAt.toISOString(),
    resolution: market.resolution,
    resolutionProb: market.resolutionProb,
    creator: market.creator,
    answers: answers.map((answer) => {
      const row = tally?.shares.find((share) => share.answerId === answer.id);
      return {
        id: answer.id,
        text: answer.text,
        probability: row ? row.share : answer.probability,
        pool: answer.pool,
        votes: row?.votes ?? 0,
      };
    }),
    ...seriesForCard(market),
  };
}

function seriesForCard(market: MarketRecord): { change24h: number | null; spark: number[] } {
  const points = market.points ?? [];
  if (!points.length) return { change24h: null, spark: [] };
  const answers = [...market.answers].sort((a, b) => b.probability - a.probability);
  const leader = answers[0]?.id;
  const readPoint = (point: { probability: number; snapshot: string }) => {
    const snapshot = safeSnapshot(point.snapshot);
    if (market.type !== "MULTIPLE") return snapshot.YES ?? point.probability;
    const value = leader ? snapshot[leader] : undefined;
    return typeof value === "number" ? value : point.probability;
  };
  const values = points.map(readPoint);
  const latest = points[points.length - 1];
  const prior = [...points].reverse().find((point) => latest.createdAt.getTime() - point.createdAt.getTime() >= 86_400_000);
  const priorValue = prior ? readPoint(prior) : null;
  const step = Math.max(1, Math.ceil(values.length / 18));
  const spark = values.filter((_, index) => index % step === 0 || index === values.length - 1);
  return {
    change24h: priorValue === null ? null : values[values.length - 1] - priorValue,
    spark,
  };
}

const marketInclude = {
  creator: { select: creatorSelect },
  answers: true,
  points: { select: { createdAt: true, probability: true, snapshot: true }, orderBy: { createdAt: "asc" as const } },
  pollVotes: { select: { userId: true, answerId: true } },
} as const;

export async function getFeed(filters: {
  q?: string;
  topic?: string;
  sort?: string;
  type?: string;
  fy?: string;
  userId?: string | null;
}) {
  const markets = await prisma.market.findMany({ include: marketInclude });
  const topic =
    filters.topic && filters.topic !== "all" ? TOPICS.find((item) => item.id === filters.topic)?.label : null;
  const q = filters.q?.trim().toLowerCase() ?? "";
  let interest = new Set<string>();
  if (filters.fy === "1" && filters.userId) {
    const positions = await prisma.position.findMany({
      where: { userId: filters.userId },
      select: { market: { select: { topic: true } } },
    });
    interest = new Set(positions.map((position) => position.market.topic));
  }

  let rows = markets.filter((market) => {
    if (topic && market.topic !== topic) return false;
    if (filters.type === "binary" && market.type !== "BINARY") return false;
    if (filters.type === "multiple" && market.type !== "MULTIPLE") return false;
    if (filters.type === "poll" && market.type !== "POLL") return false;
    if (filters.sort === "resolved" && !market.resolution) return false;
    if (!q) return true;
    const answers = market.answers.map((answer) => answer.text.toLowerCase()).join(" ");
    const haystack = `${market.question} ${market.description} ${market.creator.username} ${market.creator.name} ${answers}`.toLowerCase();
    return haystack.includes(q);
  });

  const now = Date.now();
  const score = (market: (typeof rows)[number]) => {
    const ageHours = Math.max(1, (now - market.createdAt.getTime()) / 3_600_000);
    const base = (market.volume + 40) / Math.pow(ageHours, 0.62);
    return interest.has(market.topic) ? base * 1.4 : base;
  };

  const sort = filters.sort || "trending";
  rows.sort((a, b) => {
    if (sort === "new") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "volume") return b.volume - a.volume;
    if (sort === "closing") {
      if (!!a.resolution !== !!b.resolution) return a.resolution ? 1 : -1;
      return a.closeAt.getTime() - b.closeAt.getTime();
    }
    if (sort === "resolved") return (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0);
    if (!!a.resolution !== !!b.resolution) return a.resolution ? 1 : -1;
    return score(b) - score(a);
  });

  return rows.map(toCard);
}

export async function getTopics(): Promise<TopicSummary[]> {
  const markets = await prisma.market.findMany({ select: { topic: true, volume: true, resolution: true } });
  return TOPICS.filter((topic) => topic.id !== "all").map((topic) => {
    const rows = markets.filter((market) => market.topic === topic.label);
    return {
      id: topic.id,
      label: topic.label,
      blurb: topic.blurb,
      count: rows.length,
      open: rows.filter((market) => !market.resolution).length,
      volume: rows.reduce((sum, market) => sum + market.volume, 0),
    };
  });
}

function badgeFor(
  type: "BINARY" | "MULTIPLE" | "POLL",
  positions: { userId: string; answerId: string; sharesYes: number; sharesNo: number; shares: number }[],
  answers: AnswerView[],
  userId: string,
) {
  const mine = positions.filter((position) => position.userId === userId);
  if (type === "POLL") return null;
  if (type === "BINARY") {
    const position = mine[0];
    if (!position) return null;
    if (position.sharesYes > 0.01 && position.sharesYes >= position.sharesNo) return "YES";
    if (position.sharesNo > 0.01) return "NO";
    return null;
  }
  const best = mine.filter((position) => position.shares > 0.01).sort((a, b) => b.shares - a.shares)[0];
  if (!best) return null;
  return answers.find((answer) => answer.id === best.answerId)?.text ?? null;
}

export async function getMarket(slug: string, viewerId?: string | null): Promise<MarketDetail | null> {
  const market = await prisma.market.findUnique({
    where: { slug },
    include: {
      creator: { select: creatorSelect },
      answers: true,
      points: { orderBy: { createdAt: "asc" } },
      comments: { include: { user: { select: creatorSelect } }, orderBy: { createdAt: "asc" } },
      trades: { include: { user: { select: creatorSelect } }, orderBy: { createdAt: "desc" }, take: 80 },
      positions: { include: { user: { select: creatorSelect } } },
      limitOrders: {
        where: { status: "OPEN" },
        include: { user: { select: creatorSelect } },
        orderBy: { limitProb: "desc" },
      },
      bookmarks: { where: { userId: viewerId ?? "__none__" }, select: { userId: true } },
      pollVotes: { select: { userId: true, answerId: true } },
    },
  });
  if (!market) return null;
  const card = toCard(market);
  const positions = market.positions;
  const byId = new Map(market.comments.map((comment) => [comment.id, comment]));
  const rootOf = (id: string) => {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current?.id ?? id;
  };
  const views = new Map<string, CommentView>();
  for (const comment of market.comments) {
    views.set(comment.id, {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
      badge: badgeFor(card.type, positions, card.answers, comment.userId),
      replies: [],
    });
  }
  const roots: CommentView[] = [];
  for (const comment of market.comments) {
    const view = views.get(comment.id)!;
    if (!comment.parentId) {
      roots.push(view);
      continue;
    }
    const root = views.get(rootOf(comment.id));
    if (root && root.id !== view.id) root.replies.push(view);
    else roots.push(view);
  }

  const holders = positions
    .flatMap((position) => {
      if (card.type === "BINARY") {
        const rows = [];
        if (position.sharesYes > 0.01) {
          rows.push({ user: position.user, side: "YES", shares: position.sharesYes, answerId: "" });
        }
        if (position.sharesNo > 0.01) {
          rows.push({ user: position.user, side: "NO", shares: position.sharesNo, answerId: "" });
        }
        return rows;
      }
      if (position.shares <= 0.01) return [];
      const answer = card.answers.find((item) => item.id === position.answerId);
      return [{ user: position.user, side: answer?.text ?? "Yes", shares: position.shares, answerId: position.answerId }];
    })
    .sort((a, b) => b.shares - a.shares);

  const mine = viewerId ? positions.filter((position) => position.userId === viewerId) : [];

  return {
    ...card,
    id: market.id,
    description: market.description,
    poolYes: market.poolYes,
    poolNo: market.poolNo,
    p: market.p,
    ante: market.ante,
    pot: market.pot,
    creatorId: market.creatorId,
    resolvedAt: market.resolvedAt?.toISOString() ?? null,
    resolutionNote: market.resolutionNote,
    bookmarked: market.bookmarks.length > 0,
    holdings: mine.map((position) => ({
      answerId: position.answerId,
      sharesYes: position.sharesYes,
      sharesNo: position.sharesNo,
      shares: position.shares,
      costBasisYes: position.costBasisYes,
      costBasisNo: position.costBasisNo,
      invested: position.invested,
    })),
    points: market.points.map((point) => ({
      t: point.createdAt.getTime(),
      p: point.probability,
      snapshot: safeSnapshot(point.snapshot),
    })),
    comments: roots,
    trades: market.trades.map((trade) => ({
      id: trade.id,
      user: trade.user,
      outcome: trade.outcome,
      side: trade.side,
      amount: trade.amount,
      shares: trade.shares,
      probBefore: trade.probBefore,
      probAfter: trade.probAfter,
      createdAt: trade.createdAt.toISOString(),
    })),
    holders,
    limitOrders: market.limitOrders.map((order) => ({
      id: order.id,
      user: order.user,
      outcome: order.outcome,
      limitProb: order.limitProb,
      remaining: order.remaining,
      mine: order.userId === viewerId,
    })),
    orderBook: aggregateOrderBook(
      market.limitOrders.map((order) => ({
        outcome: order.outcome,
        limitProb: order.limitProb,
        remaining: order.remaining,
      })),
    ),
    myVote: market.pollVotes.find((vote) => vote.userId === viewerId)?.answerId ?? null,
  };
}

function safeSnapshot(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type PositionWithMarket = {
  answerId: string;
  sharesYes: number;
  sharesNo: number;
  shares: number;
  costBasisYes: number;
  costBasisNo: number;
  realizedPnl: number;
  payout: number;
  market: MarketRecord & {
    poolYes: number;
    poolNo: number;
    p: number;
    resolution: string | null;
  };
};

function positionRows(positions: PositionWithMarket[]): { open: PositionRow[]; settled: PositionRow[] } {
  const open: PositionRow[] = [];
  const settled: PositionRow[] = [];
  for (const position of positions) {
    const market = position.market;
    const cardBase = {
      slug: market.slug,
      question: market.question,
      topic: market.topic,
      type: asType(market.type),
      resolved: Boolean(market.resolution),
    };
    const answers = [...market.answers].sort((a, b) => a.sortIndex - b.sortIndex);
    if (cardBase.type === "BINARY") {
      const pool = { yes: market.poolYes, no: market.poolNo, p: market.p };
      if (position.sharesYes > 0.01 && !market.resolution) {
        const mark = quoteBinarySell(pool, "YES", position.sharesYes);
        open.push({
          ...cardBase,
          side: "YES",
          outcome: "YES",
          answerId: "",
          shares: position.sharesYes,
          mark,
          cost: position.costBasisYes,
          pnl: mark - position.costBasisYes,
        });
      }
      if (position.sharesNo > 0.01 && !market.resolution) {
        const mark = quoteBinarySell(pool, "NO", position.sharesNo);
        open.push({
          ...cardBase,
          side: "NO",
          outcome: "NO",
          answerId: "",
          shares: position.sharesNo,
          mark,
          cost: position.costBasisNo,
          pnl: mark - position.costBasisNo,
        });
      }
    } else if (position.shares > 0.01 && !market.resolution) {
      const index = answers.findIndex((answer) => answer.id === position.answerId);
      const mark = index < 0 ? 0 : quoteMultiSell({ pools: answers.map((answer) => answer.pool) }, index, position.shares);
      open.push({
        ...cardBase,
        side: answers[index]?.text ?? "Yes",
        outcome: null,
        answerId: position.answerId,
        shares: position.shares,
        mark,
        cost: position.costBasisYes,
        pnl: mark - position.costBasisYes,
      });
    }
    if (market.resolution && (Math.abs(position.realizedPnl) > 0.01 || position.payout > 0.01)) {
      const answer = answers.find((item) => item.id === position.answerId);
      settled.push({
        ...cardBase,
        side: cardBase.type === "BINARY" ? (position.payout > 0 ? "Paid" : "Settled") : (answer?.text ?? "Settled"),
        outcome: null,
        answerId: position.answerId,
        shares: 0,
        mark: position.payout,
        cost: 0,
        pnl: position.realizedPnl,
      });
    }
  }
  open.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  return { open, settled };
}

export async function getPortfolio(userId: string, viewerId?: string | null): Promise<PortfolioData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      avatarColor: true,
      balance: true,
      startingBalance: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  return buildPortfolio(user, viewerId === user.id);
}

export async function getProfile(username: string, viewerId?: string | null): Promise<PortfolioData | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      avatarColor: true,
      balance: true,
      startingBalance: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  return buildPortfolio(user, viewerId === user.id);
}

async function buildPortfolio(
  user: {
    id: string;
    username: string;
    name: string;
    bio: string;
    avatarColor: string;
    balance: number;
    startingBalance: number;
    createdAt: Date;
  },
  isOwn: boolean,
): Promise<PortfolioData> {
  const [positions, trades, created, bookmarks, volumeAgg, worthPoints] = await Promise.all([
    prisma.position.findMany({
      where: { userId: user.id },
      include: { market: { include: marketInclude } },
    }),
    prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { market: { select: { slug: true, question: true } } },
    }),
    prisma.market.findMany({
      where: { creatorId: user.id },
      include: marketInclude,
      orderBy: { createdAt: "desc" },
    }),
    isOwn
      ? prisma.bookmark.findMany({
          where: { userId: user.id },
          include: { market: { include: marketInclude } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.trade.aggregate({
      where: { userId: user.id, side: { in: ["BUY", "SELL"] } },
      _sum: { amount: true },
    }),
    prisma.worthPoint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 240,
    }),
  ]);

  const shaped = positions.map((position) => ({
    ...position,
    market: {
      ...position.market,
      creator: position.market.creator,
    },
  }));
  const { open, settled } = positionRows(shaped);
  const positionValue = open.reduce((sum, row) => sum + row.mark, 0);
  const cash = user.balance;
  const netWorth = cash + positionValue;
  const history: TradeHistoryRow[] = trades.map((trade) => ({
    id: trade.id,
    slug: trade.market.slug,
    question: trade.market.question,
    outcome: trade.outcome,
    side: trade.side,
    amount: trade.amount,
    shares: trade.shares,
    probBefore: trade.probBefore,
    probAfter: trade.probAfter,
    createdAt: trade.createdAt.toISOString(),
  }));

  return {
    user: {
      username: user.username,
      name: user.name,
      avatarColor: user.avatarColor,
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      balance: cash,
      startingBalance: user.startingBalance,
    },
    isOwn,
    netWorth,
    cash,
    positionValue,
    profit: netWorth - user.startingBalance,
    volume: volumeAgg._sum.amount ?? 0,
    positions: open,
    settled,
    trades: history,
    created: created.map(toCard),
    saved: bookmarks.map((bookmark) => toCard(bookmark.market)),
    worth: [
      ...[...worthPoints].reverse().map((point) => ({ t: point.createdAt.getTime(), worth: point.worth })),
      { t: Date.now(), worth: netWorth },
    ],
  };
}

export async function getLeaderboard(window: "all" | "week" | "month", metric: "profit" | "volume"): Promise<LeaderRow[]> {
  const since =
    window === "week" ? new Date(Date.now() - 7 * 86_400_000) : window === "month" ? new Date(Date.now() - 30 * 86_400_000) : null;
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, avatarColor: true, balance: true, startingBalance: true },
  });
  const volumeGroups = await prisma.trade.groupBy({
    by: ["userId"],
    where: { side: { in: ["BUY", "SELL"] }, ...(since ? { createdAt: { gte: since } } : {}) },
    _sum: { amount: true },
  });
  const volumeOf = new Map(volumeGroups.map((group) => [group.userId, group._sum.amount ?? 0]));

  let profitOf = new Map<string, number>();
  if (window === "all") {
    const positions = await prisma.position.findMany({ include: { market: { include: { answers: true } } } });
    const byUser = new Map<string, typeof positions>();
    for (const position of positions) {
      const list = byUser.get(position.userId) ?? [];
      list.push(position);
      byUser.set(position.userId, list);
    }
    profitOf = new Map(
      users.map((user) => {
        const rows = positionRows((byUser.get(user.id) ?? []) as unknown as PositionWithMarket[]);
        const marks = rows.open.reduce((sum, row) => sum + row.mark, 0);
        return [user.id, user.balance + marks - user.startingBalance];
      }),
    );
  } else {
    const groups = await prisma.pnlEntry.groupBy({
      by: ["userId"],
      where: since ? { createdAt: { gte: since } } : undefined,
      _sum: { amount: true },
    });
    profitOf = new Map(groups.map((group) => [group.userId, group._sum.amount ?? 0]));
  }

  const rows = users
    .map((user) => ({
      user: { username: user.username, name: user.name, avatarColor: user.avatarColor },
      profit: profitOf.get(user.id) ?? 0,
      volume: volumeOf.get(user.id) ?? 0,
    }))
    .filter((row) => Math.abs(row.profit) > 0.01 || row.volume > 0.01)
    .sort((a, b) => (metric === "volume" ? b.volume - a.volume : b.profit - a.profit))
    .slice(0, 25)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return rows;
}

export async function getHomeRail(): Promise<{ movers: MarketCard[]; trades: RailTrade[] }> {
  const markets = await getFeed({});
  const movers = markets
    .filter((market) => !market.resolution && market.change24h !== null && Math.abs(market.change24h) >= 0.005)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))
    .slice(0, 5);
  const trades = await prisma.trade.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      user: { select: creatorSelect },
      market: { select: { slug: true, question: true } },
    },
  });
  return {
    movers,
    trades: trades.map((trade) => ({
      id: trade.id,
      username: trade.user.username,
      name: trade.user.name,
      avatarColor: trade.user.avatarColor,
      slug: trade.market.slug,
      question: trade.market.question,
      side: trade.side,
      outcome: trade.outcome,
      amount: trade.amount,
      createdAt: trade.createdAt.toISOString(),
    })),
  };
}

export async function getNotifications(userId: string): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));
}
