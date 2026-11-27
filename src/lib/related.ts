export type RelatedCandidate = {
  slug: string;
  topic: string;
  question: string;
  probability: number;
};

export function relatedMarkets<T extends RelatedCandidate>(current: { slug: string; topic: string }, markets: T[], limit = 4): T[] {
  return markets.filter((market) => market.slug !== current.slug && market.topic === current.topic).slice(0, limit);
}

export function embedSnippet(origin: string, slug: string): string {
  const root = origin.replace(/\/$/, "");
  const src = `${root}/embed/${encodeURIComponent(slug)}`;
  return `<iframe src="${src}" title="TriggerPointGlobal market" width="400" height="320" style="border:0;border-radius:16px"></iframe>`;
}
