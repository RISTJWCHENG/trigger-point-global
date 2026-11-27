import Link from "next/link";
import { notFound } from "next/navigation";
import { ProbChart } from "@/components/prob-chart";
import { formatPercent, formatTp } from "@/lib/format";
import { getMarket } from "@/lib/queries";

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const market = await getMarket(slug);
  if (!market) notFound();
  return (
    <div className="mx-auto max-w-[440px] p-3">
      <article className="surface p-4" data-testid="embed-card">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">TriggerPoint</p>
        <h1 className="mt-2 text-base font-medium leading-snug text-ink">{market.question}</h1>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="num text-3xl font-medium leading-none text-ink">{formatPercent(market.probability, 1)}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">chance</div>
          </div>
          <div className="text-right text-xs text-secondary">
            <div className="num">{formatTp(market.volume, "compact")} TP vol</div>
            <div className="num">{formatTp(market.liquidity, "compact")} TP liquidity</div>
          </div>
        </div>
        {market.type !== "POLL" && market.points.length > 1 && (
          <div className="mt-3">
            <ProbChart points={market.points} answers={market.answers} type={market.type === "MULTIPLE" ? "MULTIPLE" : "BINARY"} showGraphToggle={false} />
          </div>
        )}
        <Link href={`/market/${market.slug}`} className="mt-3 inline-flex text-sm text-ink underline decoration-line underline-offset-2">
          Open market
        </Link>
      </article>
    </div>
  );
}
