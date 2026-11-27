"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";
import { useToast } from "./shell";
import { postJson } from "@/lib/client";
import { cn, formatPercent, formatTp } from "@/lib/format";
import type { MarketCard, RailTrade } from "@/lib/types";

export function FeedRail({
  movers,
  trades,
  signedIn,
  bonusAvailable,
}: {
  movers: MarketCard[];
  trades: RailTrade[];
  signedIn: boolean;
  bonusAvailable: boolean;
}) {
  return (
    <div className="space-y-4">
      <DailyBonus signedIn={signedIn} available={bonusAvailable} />
      <section className="surface p-4">
        <h2 className="text-sm font-medium text-ink">Market movers</h2>
        <p className="mt-0.5 text-xs text-muted">Largest probability shifts over 24 hours.</p>
        <ul className="mt-3 space-y-3">
          {movers.length === 0 && <li className="text-sm text-secondary">No meaningful moves in the last day.</li>}
          {movers.map((market) => (
            <li key={market.slug}>
              <Link href={`/market/${market.slug}`} className="block text-sm leading-snug hover:underline">
                {market.question}
              </Link>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="num text-secondary">{formatPercent(market.probability)}</span>
                <span className={cn("num font-medium", (market.change24h ?? 0) >= 0 ? "text-yes" : "text-no")}>
                  {(market.change24h ?? 0) >= 0 ? "+" : ""}
                  {Math.round((market.change24h ?? 0) * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="surface p-4">
        <h2 className="text-sm font-medium text-ink">Recent trades</h2>
        <ul className="mt-3 space-y-3">
          {trades.map((trade) => (
            <li key={trade.id} className="flex items-start gap-2">
              <Avatar name={trade.name} color={trade.avatarColor} size={22} />
              <div className="min-w-0 text-xs leading-relaxed">
                <Link href={`/profile/${trade.username}`} className="font-medium text-ink hover:underline">
                  {trade.name}
                </Link>{" "}
                <span className="text-secondary">
                  {trade.side === "BUY" ? "bought" : "sold"} {trade.outcome}
                </span>
                <Link href={`/market/${trade.slug}`} className="mt-0.5 block truncate text-muted hover:text-ink">
                  {trade.question}
                </Link>
                <span className="num text-secondary">{formatTp(trade.amount)} TP</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function DailyBonus({ signedIn, available }: { signedIn: boolean; available: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(!available);

  async function claim() {
    if (!signedIn) {
      router.push("/signin?next=/");
      return;
    }
    setPending(true);
    try {
      const result = await postJson<{ awarded: boolean; message: string }>("/api/bonus");
      setClaimed(true);
      toast(result.message);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Bonus failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface feature p-4" data-testid="daily-bonus-card">
      <h2 className="kicker text-sm font-medium text-ink">
        <span className="index">01 / </span>Daily bonus
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-secondary">50 TP, once a day. Play money only.</p>
      <button
        type="button"
        data-testid="daily-bonus"
        disabled={pending || (signedIn && claimed)}
        onClick={() => void claim()}
        className="btn-primary mt-3 h-9 w-full text-xs"
      >
        {signedIn && claimed ? "Claimed today" : pending ? "Adding" : "Claim 50 TP"}
      </button>
    </section>
  );
}
