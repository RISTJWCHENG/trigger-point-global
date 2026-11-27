import { describe, expect, it } from "vitest";
import { toPublicMarket, toPublicUser } from "./public-api";

describe("public API shapes", () => {
  it("includes pool reserves, liquidity, and close time", () => {
    const market = toPublicMarket({
      id: "mkt_1",
      slug: "fed",
      question: "Will the desk stay open?",
      description: "Criteria.",
      type: "BINARY",
      topic: "Economics",
      probability: 0.42,
      poolYes: 120,
      poolNo: 180,
      p: 0.4,
      liquidity: 200,
      volume: 90,
      closeAt: new Date("2027-07-01T16:00:00.000Z"),
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
      resolution: null,
      answers: [],
    });
    expect(market.pool).toEqual({ YES: 120, NO: 180, p: 0.4 });
    expect(market.liquidity).toBe(200);
    expect(market.closeTime).toBe("2027-07-01T16:00:00.000Z");
    expect(market.bets).toBeUndefined();
  });

  it("attaches recent bets only when asked", () => {
    const market = toPublicMarket(
      {
        id: "mkt_1",
        slug: "fed",
        question: "Will the desk stay open?",
        description: "Criteria.",
        type: "BINARY",
        topic: "Economics",
        probability: 0.5,
        poolYes: 100,
        poolNo: 100,
        p: 0.5,
        liquidity: 100,
        volume: 10,
        closeAt: new Date("2027-07-01T16:00:00.000Z"),
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        resolution: null,
        answers: [{ id: "a", text: "Yes", probability: 0.5, pool: 100 }],
        trades: [
          {
            outcome: "YES",
            side: "BUY",
            amount: 10,
            shares: 18,
            probBefore: 0.5,
            probAfter: 0.55,
            createdAt: new Date("2026-11-02T00:00:00.000Z"),
            user: { username: "demo" },
          },
        ],
      },
      true,
    );
    expect(market.answers[0]?.text).toBe("Yes");
    expect(market.bets?.[0]).toMatchObject({ username: "demo", side: "BUY", amount: 10 });
  });

  it("returns follower counts on a public user", () => {
    const user = toPublicUser({
      id: "usr_1",
      username: "elena",
      name: "Elena",
      bio: "Macro.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      balance: 1000,
      followerCount: 3,
      followingCount: 1,
    });
    expect(user).toMatchObject({ username: "elena", followerCount: 3, followingCount: 1, balance: 1000 });
    expect(user).not.toHaveProperty("passwordHash");
  });
});
