export type Creator = {
  username: string;
  name: string;
  avatarColor: string;
};

export type AnswerView = {
  id: string;
  text: string;
  probability: number;
  pool: number;
};

export type MarketCard = {
  slug: string;
  question: string;
  type: "BINARY" | "MULTIPLE";
  topic: string;
  probability: number;
  volume: number;
  traders: number;
  closeAt: string;
  createdAt: string;
  resolution: string | null;
  resolutionProb: number | null;
  creator: Creator;
  answers: AnswerView[];
};

export type HoldingView = {
  answerId: string;
  sharesYes: number;
  sharesNo: number;
  shares: number;
  costBasisYes: number;
  costBasisNo: number;
  invested: number;
};

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  user: Creator;
  badge: string | null;
  replies: CommentView[];
};

export type TradeView = {
  id: string;
  user: Creator;
  outcome: string;
  side: string;
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  createdAt: string;
};

export type HolderView = {
  user: Creator;
  side: string;
  shares: number;
  answerId: string;
};

export type PointView = {
  t: number;
  p: number;
  snapshot: Record<string, number>;
};

export type MarketDetail = MarketCard & {
  id: string;
  description: string;
  poolYes: number;
  poolNo: number;
  p: number;
  ante: number;
  pot: number;
  creatorId: string;
  resolvedAt: string | null;
  resolutionNote: string;
  bookmarked: boolean;
  holdings: HoldingView[];
  points: PointView[];
  comments: CommentView[];
  trades: TradeView[];
  holders: HolderView[];
};

export type PositionRow = {
  slug: string;
  question: string;
  topic: string;
  type: "BINARY" | "MULTIPLE";
  side: string;
  outcome: "YES" | "NO" | null;
  answerId: string;
  shares: number;
  mark: number;
  cost: number;
  pnl: number;
  resolved: boolean;
};

export type TradeHistoryRow = {
  id: string;
  slug: string;
  question: string;
  outcome: string;
  side: string;
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  createdAt: string;
};

export type PortfolioData = {
  user: Creator & { username: string; bio: string; createdAt: string; balance: number; startingBalance: number };
  isOwn: boolean;
  netWorth: number;
  cash: number;
  positionValue: number;
  profit: number;
  volume: number;
  positions: PositionRow[];
  settled: PositionRow[];
  trades: TradeHistoryRow[];
  created: MarketCard[];
  saved: MarketCard[];
};

export type LeaderRow = {
  rank: number;
  user: Creator;
  profit: number;
  volume: number;
};

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type TopicSummary = {
  id: string;
  label: string;
  blurb: string;
  count: number;
  open: number;
  volume: number;
};
