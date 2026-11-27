import { afterAll, beforeEach, expect, it } from "vitest";
import { registerUser } from "./auth";
import { prisma } from "./db";
import { addLiquidity, createMarket, deleteComment, editComment, placeBet, postComment, sellShares, sendTip, setFollow, settleMarket, toggleCommentLike, updateMarketByCreator } from "./market-service";

async function reset() {
  await prisma.commentLike.deleteMany();
  await prisma.tip.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.marketUpdate.deleteMany();
  await prisma.limitOrder.deleteMany();
  await prisma.pollVote.deleteMany();
  await prisma.worthPoint.deleteMany();
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

it("adds liquidity without moving the probability or leaking TP", async () => {
  const user = await registerUser({
    username: "lio",
    name: "Lio Marsh",
    email: "lio@example.com",
    password: "secret12",
  });
  const before = await wealth();
  const created = await createMarket({
    creatorId: user.id,
    question: "Will a subsidy leave this price alone?",
    description: "Adding liquidity should deepen the pool and keep the probability.",
    type: "BINARY",
    topic: "tech",
    closeAt: future(),
    ante: 100,
    probability: 0.37,
  });
  const open = await prisma.market.findUniqueOrThrow({ where: { slug: created.slug } });
  await placeBet(user.id, created.slug, { amount: 25, outcome: "YES" });
  const moved = await prisma.market.findUniqueOrThrow({ where: { slug: created.slug } });
  expect(moved.probability).toBeGreaterThan(open.probability);
  await addLiquidity(user.id, created.slug, 60);
  const deeper = await prisma.market.findUniqueOrThrow({ where: { slug: created.slug } });
  expect(deeper.probability).toBeCloseTo(moved.probability, 8);
  expect(deeper.poolYes).toBeGreaterThan(moved.poolYes);
  expect(deeper.poolNo).toBeGreaterThan(moved.poolNo);
  expect(deeper.liquidity).toBeCloseTo(moved.liquidity + 60, 4);
  expect(await wealth()).toBeCloseTo(before, 2);
});

it("blocks the creator from betting when they opted out", async () => {
  const user = await registerUser({
    username: "nope",
    name: "Nope Lane",
    email: "nope@example.com",
    password: "secret12",
  });
  const created = await createMarket({
    creatorId: user.id,
    question: "Will the creator stay out of this market?",
    description: "The creator blocked themselves so a referee can resolve it.",
    type: "BINARY",
    topic: "tech",
    closeAt: future(),
    ante: 80,
    probability: 0.5,
    creatorBlocked: true,
  });
  await expect(placeBet(user.id, created.slug, { amount: 10, outcome: "YES" })).rejects.toThrow(/blocked themselves/);
});

it("likes, edits, and deletes a comment", async () => {
  const user = await registerUser({
    username: "cmt",
    name: "Cmt Lane",
    email: "cmt@example.com",
    password: "secret12",
  });
  const created = await createMarket({
    creatorId: user.id,
    question: "Will comments keep their edits and likes?",
    description: "A short market used only to hang a comment thread on.",
    type: "BINARY",
    topic: "tech",
    closeAt: future(),
    ante: 80,
    probability: 0.5,
  });
  const comment = await postComment(user.id, created.slug, "First read of the criteria.");
  const liked = await toggleCommentLike(user.id, comment.id);
  expect(liked).toEqual({ liked: true, likes: 1 });
  const cleared = await toggleCommentLike(user.id, comment.id);
  expect(cleared).toEqual({ liked: false, likes: 0 });
  const edited = await editComment(user.id, comment.id, "Revised read of the criteria.");
  expect(edited.editedAt).toBeTruthy();
  await deleteComment(user.id, comment.id);
  const row = await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } });
  expect(row.deleted).toBe(true);
});

it("follows and unfollows another trader, and refuses a self follow", async () => {
  const ada = await registerUser({ username: "adaf", name: "Ada Follow", email: "adaf@example.com", password: "secret12" });
  const bea = await registerUser({ username: "beaf", name: "Bea Follow", email: "beaf@example.com", password: "secret12" });
  await expect(setFollow(ada.id, "adaf", true)).rejects.toThrow(/yourself/);
  expect(await setFollow(ada.id, "beaf", true)).toEqual({ following: true });
  expect(await prisma.follow.count({ where: { followerId: ada.id, followingId: bea.id } })).toBe(1);
  expect(await setFollow(ada.id, "beaf", false)).toEqual({ following: false });
  expect(await prisma.follow.count()).toBe(0);
});

it("transfers TP atomically and rejects an empty purse or a self transfer", async () => {
  const ada = await registerUser({ username: "adat", name: "Ada Tip", email: "adat@example.com", password: "secret12" });
  const bea = await registerUser({ username: "beat", name: "Bea Tip", email: "beat@example.com", password: "secret12" });
  const before = await wealth();
  await sendTip(ada.id, "beat", 25, "for the close");
  const from = await prisma.user.findUniqueOrThrow({ where: { id: ada.id } });
  const to = await prisma.user.findUniqueOrThrow({ where: { id: bea.id } });
  expect(from.balance).toBeCloseTo(975, 4);
  expect(to.balance).toBeCloseTo(1025, 4);
  expect(await wealth()).toBeCloseTo(before, 2);
  await expect(sendTip(ada.id, "adat", 5)).rejects.toThrow(/yourself/);
  await expect(sendTip(ada.id, "beat", 5000)).rejects.toThrow(/Not enough/);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: ada.id } })).balance).toBeCloseTo(975, 4);
});

it("lets only the creator rewrite criteria and move the close", async () => {
  const ada = await registerUser({ username: "adac", name: "Ada Create", email: "adac@example.com", password: "secret12" });
  const bea = await registerUser({ username: "beac", name: "Bea Create", email: "beac@example.com", password: "secret12" });
  const created = await createMarket({
    creatorId: ada.id,
    question: "Will the creator be allowed to extend this close?",
    description: "The original criteria stay until the creator posts a revision.",
    type: "BINARY",
    topic: "tech",
    closeAt: future(10),
    ante: 80,
    probability: 0.5,
  });
  await expect(updateMarketByCreator(bea.id, created.slug, { note: "Not mine" })).rejects.toThrow(/Only the creator/);
  const nextClose = future(40).toISOString();
  await updateMarketByCreator(ada.id, created.slug, {
    description: "Revised criteria: this resolves on the written source, not a rumor.",
    note: "Clarified the source.",
    closeAt: nextClose,
  });
  const market = await prisma.market.findUniqueOrThrow({ where: { slug: created.slug }, include: { updates: true } });
  expect(market.description).toContain("Revised criteria");
  expect(market.closeAt.toISOString()).toBe(nextClose);
  expect(market.updates.map((update) => update.kind).sort()).toEqual(["close", "description", "note"]);
});
