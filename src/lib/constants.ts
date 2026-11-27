export const TOPICS = [
  { id: "all", label: "All", blurb: "Every open and settled market on the desk." },
  { id: "geopolitics", label: "Geopolitics", blurb: "Trade, diplomacy, and statecraft." },
  { id: "economics", label: "Economics", blurb: "Rates, inflation, growth, and indexes." },
  { id: "ai", label: "AI", blurb: "Models, labs, and the pace of capability." },
  { id: "tech", label: "Tech", blurb: "Products, platforms, and hardware ships." },
  { id: "crypto", label: "Crypto", blurb: "Coins, flows, and market structure." },
  { id: "politics", label: "Politics", blurb: "Elections, institutions, and policy." },
  { id: "science", label: "Science", blurb: "Space, climate, and research milestones." },
  { id: "sports", label: "Sports", blurb: "Titles, tournaments, and championships." },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "new", label: "New" },
  { id: "closing", label: "Closing Soon" },
  { id: "volume", label: "High Volume" },
  { id: "resolved", label: "Resolved" },
] as const;

export const TYPE_FILTERS = [
  { id: "all", label: "All types" },
  { id: "binary", label: "Binary" },
  { id: "multiple", label: "Multiple Choice" },
] as const;

export const QUICK_AMOUNTS = [10, 25, 50, 100, 250] as const;

export const STARTING_BALANCE = 1000;
export const MIN_ANTE = 50;
export const MIN_BET = 1;

export function topicLabel(id: string | undefined): string | null {
  if (!id || id === "all") return null;
  return TOPICS.find((topic) => topic.id === id)?.label ?? null;
}
