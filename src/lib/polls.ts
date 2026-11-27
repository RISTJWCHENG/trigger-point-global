export type PollBallot = { userId: string; answerId: string };

export function castVote(ballots: PollBallot[], userId: string, answerId: string): PollBallot[] {
  return [...ballots.filter((ballot) => ballot.userId !== userId), { userId, answerId }];
}

export function tallyPoll(answerIds: string[], ballots: PollBallot[]) {
  const counts = new Map(answerIds.map((id) => [id, 0]));
  for (const ballot of ballots) {
    if (!counts.has(ballot.answerId)) continue;
    counts.set(ballot.answerId, (counts.get(ballot.answerId) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const shares = answerIds.map((id) => ({
    answerId: id,
    votes: counts.get(id) ?? 0,
    share: total > 0 ? (counts.get(id) ?? 0) / total : 0,
  }));
  return { total, shares };
}
