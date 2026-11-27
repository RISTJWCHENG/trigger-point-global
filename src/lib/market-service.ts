import type { Prisma } from "@prisma/client";
import { MIN_ANTE, MIN_BET, TOPICS } from "./constants";
import { prisma } from "./db";
import { TradeError } from "./errors";
import { slugify, uid } from "./format";
import {
  buy,
  createBinaryMarket,
  createMultiMarket,
  resolveMarket,
  sell,
  type LedgerMarket,
  type ResolveInput,
  type Wallet,
} from "./ledger";

type Tx = Prisma.TransactionClient;

type DbMarket = Prisma.MarketGetPayload<{ include: { answers: true; positions: true } }>;

function toLedger(market: DbMarket): LedgerMarket {
  const answers = [...market.answers].sort((a, b) => a.sortIndex - b.sortIndex);
  return {
    id: market.id,
    type: market.type === "MULTIPLE" ? "MULTIPLE" : "BINARY",
    poolYes: market.poolYes,
    poolNo: market.poolNo,
    p: market.p,
    probability: market.probability,
    pot: market.pot,
    ante: market.ante,
    volume: market.volume,
    traderIds: [],
    resolution: market.resolution,
    resolutionProb: market.resolutionProb,
    answers: answers.map((answer) => ({
      id: answer.id,
      text: answer.text,
      pool: answer.pool,
      probability: answer.probability,
    })),
    positions: market.positions.map((position) => ({
      userId: position.userId,
      answerId: position.answerId,
      sharesYes: position.sharesYes,
      sharesNo: position.sharesNo,
      shares: position.shares,
      invested: position.invested,
      costBasisYes: position.costBasisYes,
      costBasisNo: position.costBasisNo,
      realizedPnl: position.realizedPnl,
      payout: position.payout,
    })),
  };
}

async function saveMarketState(tx: Tx, market: LedgerMarket, traderDelta: number) {
  await tx.market.update({
    where: { id: market.id },
    data: {
      poolYes: market.poolYes,
      poolNo: market.poolNo,
      p: market.p,
      probability: market.probability,
      pot: market.pot,
      volume: market.volume,
      traderCount: { increment: traderDelta },
      resolution: market.resolution,
      resolutionProb: market.resolutionProb,
      resolvedAt: market.resolution ? new Date() : null,
    },
  });
  for (const answer of market.answers) {
    await tx.answer.update({
      where: { id: answer.id },
      data: { pool: answer.pool, probability: answer.probability },
    });
  }
}

async function savePosition(tx: Tx, market: LedgerMarket, userId: string, answerId: string) {
  const position = market.positions.find((item) => item.userId === userId && item.answerId === answerId);
  if (!position) return;
  await tx.position.upsert({
    where: { userId_marketId_answerId: { userId, marketId: market.id, answerId } },
    create: { id: uid("pos"), marketId: market.id, ...position },
    update: {
      sharesYes: position.sharesYes,
      sharesNo: position.sharesNo,
      shares: position.shares,
      invested: position.invested,
      costBasisYes: position.costBasisYes,
      costBasisNo: position.costBasisNo,
      realizedPnl: position.realizedPnl,
      payout: position.payout,
    },
  });
}

function topicName(topic: string) {
  const found = TOPICS.find((item) => item.id === topic || item.label.toLowerCase() === topic.toLowerCase());
  if (!found || found.id === "all") throw new TradeError("Choose a topic");
  return found.label;
}

async function uniqueSlug(tx: Tx, question: string) {
  const base = slugify(question);
  const taken = await tx.market.findUnique({ where: { slug: base }, select: { id: true } });
  if (!taken) return base;
  return `${base}-${uid().slice(0, 4)}`;
}

export async function createMarket(input: {
  creatorId: string;
  question: string;
  description: string;
  type: "BINARY" | "MULTIPLE";
  topic: string;
  closeAt: Date;
  ante: number;
  probability?: number;
  answers?: { text: string; probability?: number }[];
}) {
  const question = input.question.trim().replace(/[ \t]+/g, " ");
  const description = input.description.trim();
  if (question.length < 10 || question.length > 180) {
    throw new TradeError("Questions need between 10 and 180 characters");
  }
  if (description.length < 20 || description.length > 4000) {
    throw new TradeError("Add resolution criteria of at least 20 characters");
  }
  if (!(input.closeAt instanceof Date) || Number.isNaN(input.closeAt.getTime())) {
    throw new TradeError("Choose a close date");
  }
  if (input.closeAt.getTime() < Date.now() + 60 * 60 * 1000) {
    throw new TradeError("Close the market at least an hour from now");
  }
  if (!Number.isFinite(input.ante) || input.ante < MIN_ANTE) {
    throw new TradeError(`Liquidity ante must be at least ${MIN_ANTE} TP`);
  }
  const topic = topicName(input.topic);

  return prisma.$transaction(async (tx) => {
    const creator = await tx.user.findUnique({ where: { id: input.creatorId } });
    if (!creator) throw new TradeError("Sign in required", 401);
    if (creator.balance + 1e-8 < input.ante) throw new TradeError("Not enough TP for that ante");

    const id = uid("mkt");
    let ledger: LedgerMarket;
    let answerRows: { id: string; text: string; sortIndex: number; pool: number; probability: number }[] = [];
    if (input.type === "MULTIPLE") {
      const answers = (input.answers ?? []).map((answer) => ({ text: answer.text.trim(), probability: answer.probability }));
      if (answers.length < 2) throw new TradeError("Add at least two answers");
      if (answers.some((answer) => answer.text.length < 1 || answer.text.length > 80)) {
        throw new TradeError("Each answer needs 1–80 characters");
      }
      const withIds = answers.map((answer) => ({ ...answer, id: uid("ans") }));
      ledger = createMultiMarket(id, input.ante, withIds);
      answerRows = ledger.answers.map((answer, index) => ({
        id: answer.id,
        text: answer.text,
        sortIndex: index,
        pool: answer.pool,
        probability: answer.probability,
      }));
    } else {
      const probability = input.probability ?? 0.5;
      if (probability < 0.01 || probability > 0.99) throw new TradeError("Initial probability must be between 1% and 99%");
      ledger = createBinaryMarket(id, input.ante, probability);
    }

    const slug = await uniqueSlug(tx, question);
    await tx.user.update({ where: { id: creator.id }, data: { balance: creator.balance - input.ante } });
    await tx.market.create({
      data: {
        id,
        slug,
        question,
        description,
        type: input.type,
        topic,
        closeAt: input.closeAt,
        createdAt: new Date(),
        poolYes: ledger.poolYes,
        poolNo: ledger.poolNo,
        p: ledger.p,
        probability: ledger.probability,
        pot: ledger.pot,
        ante: ledger.ante,
        volume: 0,
        traderCount: 0,
        creatorId: creator.id,
      },
    });
    if (answerRows.length) {
      await tx.answer.createMany({ data: answerRows.map((answer) => ({ ...answer, marketId: id })) });
    }
    await tx.probPoint.create({
      data: {
        id: uid("pt"),
        marketId: id,
        probability: ledger.probability,
        snapshot:
          input.type === "BINARY"
            ? JSON.stringify({ YES: ledger.probability })
            : JSON.stringify(Object.fromEntries(ledger.answers.map((answer) => [answer.id, answer.probability]))),
        createdAt: new Date(),
      },
    });
    return { slug, id };
  });
}

async function loadOpen(tx: Tx, slug: string) {
  const dbMarket = await tx.market.findUnique({
    where: { slug },
    include: { answers: true, positions: true },
  });
  if (!dbMarket) throw new TradeError("Market not found", 404);
  return dbMarket;
}

export async function placeBet(
  userId: string,
  slug: string,
  input: { amount: number; outcome?: "YES" | "NO"; answerId?: string },
) {
  if (!Number.isFinite(input.amount) || input.amount < MIN_BET) throw new TradeError(`Minimum bet is ${MIN_BET} TP`);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new TradeError("Sign in required", 401);
    const dbMarket = await loadOpen(tx, slug);
    const market = toLedger(dbMarket);
    const wallet: Wallet = { id: user.id, balance: user.balance };
    const prior = await tx.trade.findFirst({ where: { marketId: market.id, userId }, select: { id: true } });
    const fill = buy(market, wallet, input);
    await tx.user.update({ where: { id: user.id }, data: { balance: wallet.balance } });
    await saveMarketState(tx, market, prior ? 0 : 1);
    await savePosition(tx, market, user.id, fill.answerId);
    const createdAt = new Date();
    await tx.trade.create({
      data: {
        id: uid("trd"),
        userId,
        marketId: market.id,
        answerId: fill.answerId,
        outcome: fill.outcome,
        side: "BUY",
        amount: fill.amount,
        shares: fill.shares,
        probBefore: fill.probBefore,
        probAfter: fill.probAfter,
        createdAt,
      },
    });
    await tx.probPoint.create({
      data: {
        id: uid("pt"),
        marketId: market.id,
        probability: fill.probAfter,
        snapshot: fill.snapshot,
        createdAt,
      },
    });
    await tx.notification.create({
      data: {
        id: uid("ntf"),
        userId,
        type: "TRADE",
        title: "Trade filled",
        body: `Bought ${fill.shares.toFixed(1)} ${fill.outcome} for ${fill.amount.toFixed(2)} TP.`,
        href: `/market/${dbMarket.slug}`,
        createdAt,
      },
    });
    return {
      shares: fill.shares,
      amount: fill.amount,
      outcome: fill.outcome,
      probBefore: fill.probBefore,
      probAfter: fill.probAfter,
      balance: wallet.balance,
    };
  });
}

export async function sellShares(
  userId: string,
  slug: string,
  input: { shares: number; outcome?: "YES" | "NO"; answerId?: string },
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new TradeError("Sign in required", 401);
    const dbMarket = await loadOpen(tx, slug);
    const market = toLedger(dbMarket);
    const wallet: Wallet = { id: user.id, balance: user.balance };
    const fill = sell(market, wallet, input);
    await tx.user.update({ where: { id: user.id }, data: { balance: wallet.balance } });
    await saveMarketState(tx, market, 0);
    await savePosition(tx, market, user.id, fill.answerId);
    const createdAt = new Date();
    await tx.trade.create({
      data: {
        id: uid("trd"),
        userId,
        marketId: market.id,
        answerId: fill.answerId,
        outcome: fill.outcome,
        side: "SELL",
        amount: fill.amount,
        shares: fill.shares,
        probBefore: fill.probBefore,
        probAfter: fill.probAfter,
        createdAt,
      },
    });
    await tx.probPoint.create({
      data: {
        id: uid("pt"),
        marketId: market.id,
        probability: fill.probAfter,
        snapshot: fill.snapshot,
        createdAt,
      },
    });
    if (Math.abs(fill.realizedPnl) > 1e-8) {
      await tx.pnlEntry.create({
        data: { id: uid("pnl"), userId, marketId: market.id, amount: fill.realizedPnl, createdAt },
      });
    }
    await tx.notification.create({
      data: {
        id: uid("ntf"),
        userId,
        type: "TRADE",
        title: "Sale filled",
        body: `Sold ${fill.shares.toFixed(1)} ${fill.outcome} for ${fill.amount.toFixed(2)} TP.`,
        href: `/market/${dbMarket.slug}`,
        createdAt,
      },
    });
    return {
      shares: fill.shares,
      amount: fill.amount,
      outcome: fill.outcome,
      probBefore: fill.probBefore,
      probAfter: fill.probAfter,
      realizedPnl: fill.realizedPnl,
      balance: wallet.balance,
    };
  });
}

export async function settleMarket(userId: string, slug: string, input: ResolveInput, note = "") {
  return prisma.$transaction(async (tx) => {
    const dbMarket = await tx.market.findUnique({
      where: { slug },
      include: { answers: true, positions: true },
    });
    if (!dbMarket) throw new TradeError("Market not found", 404);
    if (dbMarket.creatorId !== userId) throw new TradeError("Only the market creator can resolve it", 403);
    const ids = [...new Set([dbMarket.creatorId, ...dbMarket.positions.map((position) => position.userId)])];
    const users = await tx.user.findMany({ where: { id: { in: ids } } });
    const wallets = new Map<string, Wallet>(users.map((user) => [user.id, { id: user.id, balance: user.balance }]));
    const market = toLedger(dbMarket);
    const result = resolveMarket(market, wallets, dbMarket.creatorId, input);
    const createdAt = new Date();
    await tx.market.update({
      where: { id: market.id },
      data: {
        poolYes: market.poolYes,
        poolNo: market.poolNo,
        probability: market.probability,
        pot: 0,
        resolution: market.resolution,
        resolutionProb: market.resolutionProb,
        resolutionNote: note.trim().slice(0, 500),
        resolvedAt: createdAt,
      },
    });
    for (const answer of market.answers) {
      await tx.answer.update({
        where: { id: answer.id },
        data: { pool: answer.pool, probability: answer.probability },
      });
    }
    for (const position of market.positions) {
      await savePosition(tx, market, position.userId, position.answerId);
    }
    for (const user of users) {
      const wallet = wallets.get(user.id);
      if (!wallet) continue;
      await tx.user.update({ where: { id: user.id }, data: { balance: wallet.balance } });
    }
    if (result.pnl.length) {
      await tx.pnlEntry.createMany({
        data: result.pnl.map((entry) => ({
          id: uid("pnl"),
          userId: entry.userId,
          marketId: market.id,
          amount: entry.amount,
          createdAt,
        })),
      });
    }
    await tx.probPoint.create({
      data: {
        id: uid("pt"),
        marketId: market.id,
        probability: result.probability,
        snapshot:
          market.type === "BINARY"
            ? JSON.stringify({ YES: result.probability })
            : JSON.stringify(Object.fromEntries(market.answers.map((answer) => [answer.id, answer.probability]))),
        createdAt,
      },
    });
    const label = describeResolution(market, dbMarket.question);
    const notified = new Set<string>();
    for (const credit of result.credits) {
      if (credit.role !== "trader" || notified.has(credit.userId)) continue;
      notified.add(credit.userId);
      await tx.notification.create({
        data: {
          id: uid("ntf"),
          userId: credit.userId,
          type: "RESOLUTION",
          title: "Market resolved",
          body:
            credit.payout > 0.004
              ? `${label} You were paid ${credit.payout.toFixed(2)} TP.`
              : `${label} Your position paid out 0 TP.`,
          href: `/market/${slug}`,
          createdAt,
        },
      });
    }
    await tx.notification.create({
      data: {
        id: uid("ntf"),
        userId: dbMarket.creatorId,
        type: "RESOLUTION",
        title: "You resolved a market",
        body: label,
        href: `/market/${slug}`,
        createdAt,
      },
    });
    return { resolution: market.resolution, probability: result.probability };
  });
}

function describeResolution(market: LedgerMarket, question: string) {
  const title = `“${question}”`;
  if (market.resolution === "YES") return `${title} resolved YES.`;
  if (market.resolution === "NO") return `${title} resolved NO.`;
  if (market.resolution === "CANCEL") return `${title} was cancelled and stakes were returned.`;
  if (market.resolution === "MKT") {
    if (market.type === "MULTIPLE") return `${title} resolved to a split.`;
    return `${title} resolved at ${Math.round((market.resolutionProb ?? market.probability) * 100)}%.`;
  }
  const answer = market.answers.find((item) => item.id === market.resolution);
  return answer ? `${title} resolved to ${answer.text}.` : `${title} resolved.`;
}

export async function postComment(userId: string, slug: string, body: string, parentId?: string | null) {
  const text = body.trim();
  if (text.length < 1 || text.length > 2000) throw new TradeError("Comments need between 1 and 2000 characters");
  const market = await prisma.market.findUnique({ where: { slug }, select: { id: true, question: true, slug: true } });
  if (!market) throw new TradeError("Market not found", 404);
  let parentAuthor: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.marketId !== market.id) throw new TradeError("That comment is no longer available");
    parentAuthor = parent.userId;
  }
  const comment = await prisma.comment.create({
    data: { id: uid("cmt"), marketId: market.id, userId, parentId: parentId || null, body: text, createdAt: new Date() },
  });
  if (parentAuthor && parentAuthor !== userId) {
    const author = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        id: uid("ntf"),
        userId: parentAuthor,
        type: "REPLY",
        title: "New reply",
        body: `${author?.name ?? "Someone"} replied to your comment on “${market.question}”.`,
        href: `/market/${market.slug}`,
        createdAt: new Date(),
      },
    });
  }
  return { id: comment.id };
}

export async function toggleBookmark(userId: string, slug: string) {
  const market = await prisma.market.findUnique({ where: { slug }, select: { id: true } });
  if (!market) throw new TradeError("Market not found", 404);
  const existing = await prisma.bookmark.findUnique({
    where: { userId_marketId: { userId, marketId: market.id } },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { userId_marketId: { userId, marketId: market.id } } });
    return { saved: false };
  }
  await prisma.bookmark.create({ data: { userId, marketId: market.id } });
  return { saved: true };
}

export async function markNotificationsRead(userId: string, id?: string) {
  await prisma.notification.updateMany({
    where: { userId, ...(id ? { id } : {}), read: false },
    data: { read: true },
  });
}
