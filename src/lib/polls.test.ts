import { describe, expect, it } from "vitest";
import { castVote, tallyPoll } from "./polls";

describe("poll voting", () => {
  const answers = ["a", "b", "c"];

  it("counts first votes and converts them to shares of the turnout", () => {
    const ballots = [
      { userId: "u1", answerId: "a" },
      { userId: "u2", answerId: "a" },
      { userId: "u3", answerId: "b" },
    ];
    const tally = tallyPoll(answers, ballots);
    expect(tally.total).toBe(3);
    expect(tally.shares.find((row) => row.answerId === "a")).toMatchObject({ votes: 2, share: 2 / 3 });
    expect(tally.shares.find((row) => row.answerId === "c")?.votes).toBe(0);
  });

  it("replaces a voter's previous choice instead of counting twice", () => {
    const first = castVote([], "u1", "a");
    const changed = castVote(first, "u1", "c");
    expect(changed).toEqual([{ userId: "u1", answerId: "c" }]);
    const tally = tallyPoll(answers, changed);
    expect(tally.total).toBe(1);
    expect(tally.shares.find((row) => row.answerId === "a")?.votes).toBe(0);
    expect(tally.shares.find((row) => row.answerId === "c")?.share).toBe(1);
  });
});
