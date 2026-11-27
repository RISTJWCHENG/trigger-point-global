import { FeedHeader, type FeedQuery } from "@/components/feed-header";
import { MarketCard } from "@/components/market-card";
import { getCurrentUser } from "@/lib/auth";
import { getFeed } from "@/lib/queries";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query: FeedQuery = {
    q: one(params.q),
    topic: one(params.topic) || "all",
    sort: one(params.sort) || "trending",
    type: one(params.type) || "all",
    fy: one(params.fy) === "1" ? "1" : "0",
  };
  const user = await getCurrentUser();
  const markets = await getFeed({ ...query, userId: user?.id });

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 lg:px-6">
      <FeedHeader query={query} signedIn={Boolean(user)} />
      <div className="mt-4 space-y-3">
        {markets.length === 0 ? (
          <div className="surface px-4 py-10 text-center text-sm text-secondary">No markets match those filters.</div>
        ) : (
          markets.map((market) => <MarketCard key={market.slug} market={market} signedIn={Boolean(user)} />)
        )}
      </div>
    </div>
  );
}
