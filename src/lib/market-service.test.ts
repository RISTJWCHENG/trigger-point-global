import { afterAll, beforeEach, expect, it } from "vitest";
import { registerUser } from "./auth";
import { prisma } from "./db";
import { createMarket, placeBet, sellShares, settleMarket } from "./market-service";

async function reset() {
  await prisma.notification.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.pnlEntry.deleteMany();
  await prisma.comment.deleteMany({ where: { parentId: { not: null } } });
  await prisma.comment.deleteMany();
  await prisma.probPoint.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.market.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

function future(days = 20) {
  return new Date(Date.now() + days * 86_400_000);
}

async function wealth() {
  const users = await prisma.user.aggregate({ _sum: { balance: true } });
  const markets = await prisma.market.aggregate({ _sum: { pot: true } });
  return (users._sum.balance ?? 0) + (markets._sum.pot ?? 0);
}

it("buys, sells, and resolves a binary market without creating or destroying TP", async () => {
  const user = await registerUser({
    username: "ada",
    name: "Ada Lane",
    email: "ada@example.com",
    password: "secret12",
  });
  const before = await wealth();
  expect(before).toBeCloseTo(1000, 4);

  const created = await createMarket({
    creatorId: user.id,
    question: "Will the test desk stay solvent through resolution?",
    description: "Resolves YES if the balance returns to the starting grant.",
    type: "BINARY",
    topic: "economics",
    closeAt: future(),
    ante: 100,
    probability: 0.42,
  });

  const bought = await placeBet(user.id, created.slug, { amount: 40, outcome: "YES" });
  expect(bought.probAfter).toBeGreaterThan(0.42);
  expect(bought.shares).toBeGreaterThan(40);
  expect(bought.balance).toBeCloseTo(860, 4);
  expect(await wealth()).toBeCloseTo(before, 3);

  const position = await prisma.position.findFirstOrThrow({ where: { userId: user.id } });
  const sold = await sellShares(user.id, created.slug, { shares: position.sharesYes, outcome: "YES" });
  expect(sold.amount).toBeCloseTo(40, 2);
  expect(sold.balance).toBeCloseTo(900, 2);

  const again = await placeBet(user.id, created.slug, { amount: 25, outcome: "NO" });
  expect(again.probAfter).toBeLessThan(bought.probAfter);
  await settleMarket(user.id, created.slug, { resolution: "YES" });

  const market = await prisma.market.findUniqueOrThrow({ where: { slug: created.slug } });
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(market.resolution).toBe("YES");
  expect(market.pot).toBeCloseTo(0, 4);
  expect(market.probability).toBeCloseTo(1, 4);
  expect(updated.balance).toBeCloseTo(1000, 2);
  expect(await wealth()).toBeCloseTo(before, 2);
});

it("moves a multiple-choice answer and pays the winner", async () => {
  const user = await registerUser({
    username: "bea",
    name: "Bea Cole",
    email: "bea@example.com",
    password: "secret12",
  });
  const before = await wealth();
  const created = await createMarket({
    creatorId: user.id,
    question: "Which of these answers clears the pool?",
    description: "Resolves to the answer named by the creator in the test.",
    type: "MULTIPLE",
    topic: "ai",
    closeAt: future(),
    ante: 150,
    answers: [{ text: "Alpha" }, { text: "Beta" }, { text: "Gamma" }],
  });
  const market = await prisma.market.findUniqueOrThrow({
    where: { slug: created.slug },
    include: { answers: { orderBy: { sortIndex: "asc" } } },
  });
  expect(market.answers.reduce((sum, answer) => sum + answer.probability, 0)).toBeCloseTo(1, 6);

  const target = market.answers[1];
  const bought = await placeBet(user.id, created.slug, { amount: 30, answerId: target.id });
  expect(bought.probAfter).toBeGreaterThan(target.probability);
  const after = await prisma.answer.findMany({ where: { marketId: market.id } });
  expect(after.reduce((sum, answer) => sum + answer.probability, 0)).toBeCloseTo(1, 6);

  await settleMarket(user.id, created.slug, { resolution: "ANSWER", answerId: target.id });
  const settled = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const pot = await prisma.market.findUniqueOrThrow({ where: { id: market.id } });
  expect(pot.resolution).toBe(target.id);
  expect(pot.pot).toBeCloseTo(0, 4);
  expect(settled.balance).toBeGreaterThan(1000 - 150);
  expect(await wealth()).toBeCloseTo(before, 2);
});

it("cancels a market and returns the stake and the ante", async () => {
  const user = await registerUser({
    username: "cio",
    name: "Cio Marsh",
    email: "cio@example.com",
    password: "secret12",
  });
  const created = await createMarket({
    creatorId: user.id,
    question: "Will this cancelled market refund both sides?",
    description: "Resolves N/A so every net stake goes back to the trader.",
    type: "BINARY",
    topic: "tech",
    closeAt: future(),
    ante: 80,
    probability: 0.5,
  });
  await placeBet(user.id, created.slug, { amount: 20, outcome: "YES" });
  await settleMarket(user.id, created.slug, { resolution: "CANCEL" });
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(updated.balance).toBeCloseTo(1000, 2);
});
