"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";
import { MarketCard } from "./market-card";
import { useToast } from "./shell";
import { postJson } from "@/lib/client";
import { cn, formatDay, formatDateTime, formatPercent, formatShares, formatSignedTp, formatTp } from "@/lib/format";
import type { PortfolioData } from "@/lib/types";

const tabs = ["Positions", "Trades", "Created", "Saved"] as const;

export function PortfolioView({ data }: { data: PortfolioData }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Positions");
  const visible = data.isOwn ? tabs : tabs.filter((item) => item !== "Saved");
  const profitTone = data.profit > 0.5 ? "text-yes" : data.profit < -0.5 ? "text-no" : "text-ink";

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Avatar name={data.user.name} color={data.user.avatarColor} size={48} />
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{data.user.name}</h1>
          <p className="text-sm text-secondary">
            @{data.user.username}
            <span className="text-muted"> · </span>
            Joined {formatDay(data.user.createdAt)}
          </p>
        </div>
      </div>
      {data.user.bio && <p className="mt-3 max-w-xl text-sm text-secondary">{data.user.bio}</p>}

      {data.worth.length > 1 && <WorthChart points={data.worth} />}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.isOwn && <Stat label="Net worth" value={`${formatTp(data.netWorth)} TP`} />}
        {data.isOwn && <Stat label="Cash" value={`${formatTp(data.cash)} TP`} testId="portfolio-cash" />}
        <Stat label="Position value" value={`${formatTp(data.positionValue)} TP`} />
        <Stat label="Profit" value={`${formatSignedTp(data.profit)} TP`} className={profitTone} testId="portfolio-profit" />
        {!data.isOwn && <Stat label="Volume" value={`${formatTp(data.volume, "compact")} TP`} />}
      </div>

      <div className="mt-6 flex gap-4 border-b border-line">
        {visible.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn("border-b-2 pb-2 text-sm", tab === item ? "border-action text-ink" : "border-transparent text-secondary")}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Positions" && <Positions data={data} />}
        {tab === "Trades" && <Trades data={data} />}
        {tab === "Created" && <CardList markets={data.created} empty="No markets created yet." signedIn={data.isOwn} />}
        {tab === "Saved" && <CardList markets={data.saved} empty="Save a market from its page to watch it here." signedIn />}
      </div>
    </div>
  );
}

function WorthChart({ points }: { points: { t: number; worth: number }[] }) {
  const width = 640;
  const height = 180;
  const pad = { l: 44, r: 12, t: 16, b: 22 };
  const min = Math.min(...points.map((point) => point.worth));
  const max = Math.max(...points.map((point) => point.worth));
  const span = Math.max(1, max - min);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t || t0 + 1;
  const xAt = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (width - pad.l - pad.r);
  const yAt = (worth: number) => pad.t + (1 - (worth - min) / span) * (height - pad.t - pad.b);
  const d = points.map((point, index) => `${index ? "L" : "M"}${xAt(point.t).toFixed(1)},${yAt(point.worth).toFixed(1)}`).join(" ");
  return (
    <section className="surface mt-5 p-4" data-testid="worth-chart">
      <h2 className="text-sm font-medium text-ink">Net worth</h2>
      <p className="mt-0.5 text-xs text-muted">Cash after each fill. The latest point includes open positions at liquidation value.</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-[180px] w-full" role="img" aria-label="Net worth history">
        <line x1={pad.l} x2={width - pad.r} y1={yAt(max)} y2={yAt(max)} stroke="var(--line)" />
        <line x1={pad.l} x2={width - pad.r} y1={yAt(min)} y2={yAt(min)} stroke="var(--line)" />
        <text x={pad.l - 8} y={yAt(max) + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
          {Math.round(max)}
        </text>
        <text x={pad.l - 8} y={yAt(min) + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
          {Math.round(min)}
        </text>
        <path d={d} fill="none" stroke="var(--action)" strokeWidth="1.8" />
      </svg>
    </section>
  );
}

function Stat({ label, value, className, testId }: { label: string; value: string; className?: string; testId?: string }) {
  return (
    <div className="surface px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("num mt-1 text-lg font-medium", className)} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

function Positions({ data }: { data: PortfolioData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);

  async function sell(row: PortfolioData["positions"][number]) {
    setPending(`${row.slug}-${row.side}`);
    try {
      const result = await postJson<{ amount: number }>(`/api/markets/${row.slug}/sell`, {
        shares: row.shares,
        outcome: row.outcome ?? undefined,
        answerId: row.answerId || undefined,
      });
      toast(`Sold for ${formatTp(result.amount)} TP`);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Sale failed");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      {data.positions.length === 0 ? (
        <p className="text-sm text-secondary">No open positions. Browse the feed and take a side.</p>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Market</th>
                <th className="px-3 py-3 font-medium">Side</th>
                <th className="px-3 py-3 font-medium">Shares</th>
                <th className="px-3 py-3 font-medium">Mark</th>
                <th className="px-3 py-3 font-medium">P&L</th>
                {data.isOwn && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {data.positions.map((row) => (
                <tr key={`${row.slug}-${row.side}`} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/market/${row.slug}`} className="font-medium hover:underline">
                      {row.question}
                    </Link>
                    <div className="text-xs text-muted">{row.topic}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", row.side === "NO" ? "bg-noTint text-no" : "bg-yesTint text-yes")}>
                      {row.side}
                    </span>
                  </td>
                  <td className="num px-3 py-3">{formatShares(row.shares)}</td>
                  <td className="num px-3 py-3">{formatTp(row.mark)}</td>
                  <td className={cn("num px-3 py-3", row.pnl >= 0 ? "text-yes" : "text-no")}>{formatSignedTp(row.pnl)}</td>
                  {data.isOwn && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        data-testid={`quick-sell-${row.slug}`}
                        disabled={pending === `${row.slug}-${row.side}`}
                        onClick={() => void sell(row)}
                        className="btn h-8 border border-line bg-card px-3 text-xs hover:bg-pill"
                      >
                        Sell
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.settled.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ink">Settled</h2>
          <ul className="mt-2 divide-y divide-line">
            {data.settled.map((row) => (
              <li key={`${row.slug}-${row.side}-${row.pnl}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/market/${row.slug}`} className="min-w-0 truncate hover:underline">
                  {row.question}
                </Link>
                <span className={cn("num shrink-0", row.pnl >= 0 ? "text-yes" : "text-no")}>{formatSignedTp(row.pnl)} TP</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Trades({ data }: { data: PortfolioData }) {
  if (data.trades.length === 0) return <p className="text-sm text-secondary">No trades yet.</p>;
  return (
    <ul className="surface divide-y divide-line">
      {data.trades.map((trade) => (
        <li key={trade.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <Link href={`/market/${trade.slug}`} className="font-medium hover:underline">
              {trade.side === "BUY" ? "Bought" : "Sold"} {trade.outcome}
            </Link>
            <div className="truncate text-xs text-muted">{trade.question}</div>
          </div>
          <div className="num text-right">
            <div>{formatTp(trade.amount)} TP</div>
            <div className="text-xs text-secondary">
              {formatPercent(trade.probBefore, 0)} → {formatPercent(trade.probAfter, 0)}
            </div>
            <div className="text-xs text-muted">{formatDateTime(trade.createdAt)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardList({
  markets,
  empty,
  signedIn,
}: {
  markets: PortfolioData["created"];
  empty: string;
  signedIn: boolean;
}) {
  if (markets.length === 0) return <p className="text-sm text-secondary">{empty}</p>;
  return (
    <div className="space-y-3">
      {markets.map((market) => (
        <MarketCard key={market.slug} market={market} signedIn={signedIn} />
      ))}
    </div>
  );
}
