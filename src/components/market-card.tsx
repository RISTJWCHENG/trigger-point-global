"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";
import { useToast } from "./shell";
import { TOPICS } from "@/lib/constants";
import { postJson } from "@/lib/client";
import { cn, formatCents, formatClose, formatPercent, formatShares, formatTp, resolutionLabel } from "@/lib/format";
import type { MarketCard as Card } from "@/lib/types";

export function MarketCard({ market, signedIn }: { market: Card; signedIn: boolean }) {
  const topicId = TOPICS.find((topic) => topic.label === market.topic)?.id ?? "all";
  const leader = [...market.answers].sort((a, b) => b.probability - a.probability)[0];
  const headline = market.type === "MULTIPLE" && leader ? leader.probability : market.probability;
  const headlineLabel = market.type === "MULTIPLE" && leader ? leader.text : "chance";
  const resolved = resolutionLabel(market.resolution, market.resolutionProb, market.answers, market.type);

  return (
    <article className="surface p-4 transition hover:border-[#D9D5CC]" data-testid="market-card" data-slug={market.slug}>
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-secondary">
            <Avatar name={market.creator.name} color={market.creator.avatarColor} size={22} />
            <Link href={`/profile/${market.creator.username}`} className="font-medium text-ink hover:underline">
              {market.creator.name}
            </Link>
            <span className="text-muted">·</span>
            <Link href={`/?topic=${topicId}&fy=0`} className="hover:text-ink">
              {market.topic}
            </Link>
          </div>
          <Link href={`/market/${market.slug}`} className="mt-1.5 block text-[15.5px] font-medium leading-snug text-ink">
            {market.question}
          </Link>
          {market.type === "MULTIPLE" ? (
            <div className="mt-3 space-y-1.5">
              {market.answers
                .slice()
                .sort((a, b) => b.probability - a.probability)
                .slice(0, 3)
                .map((answer) => (
                  <div key={answer.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate text-secondary">{answer.text}</div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-pill">
                        <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(2, answer.probability * 100)}%` }} />
                      </div>
                    </div>
                    <span className="num text-ink">{formatPercent(answer.probability)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pill">
              <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(1.5, market.probability * 100)}%` }} />
            </div>
          )}
          <div className="mt-3">
            {resolved ? (
              <span className="inline-flex rounded-full bg-pill px-2.5 py-1 text-xs font-medium text-ink">{resolved}</span>
            ) : market.type === "BINARY" ? (
              <QuickBet market={market} signedIn={signedIn} />
            ) : (
              <Link href={`/market/${market.slug}`} className="btn-primary h-8 px-3 text-[13px]">
                Trade
              </Link>
            )}
          </div>
          <p className="mt-2.5 text-xs text-secondary">
            <span className="num">{formatTp(market.volume, "compact")} TP vol</span>
            <span className="text-muted"> · </span>
            <span className="num">{market.traders} traders</span>
            <span className="text-muted"> · </span>
            {formatClose(market.closeAt)}
          </p>
        </div>
        <Link href={`/market/${market.slug}`} className="shrink-0 pt-5 text-right">
          <div className="num text-[28px] font-medium leading-none tracking-tight text-ink">{formatPercent(headline)}</div>
          <div className="mt-1 max-w-[88px] truncate text-[11px] uppercase tracking-wide text-muted">{headlineLabel}</div>
        </Link>
      </div>
    </article>
  );
}

function QuickBet({ market, signedIn }: { market: Card; signedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<"YES" | "NO" | null>(null);
  const [amount, setAmount] = useState("10");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!signedIn) {
      router.push(`/signin?next=/market/${market.slug}`);
      return;
    }
    const stake = Number(amount);
    if (!open || !(stake >= 1)) return;
    setPending(true);
    try {
      const result = await postJson<{ shares: number; probAfter: number; outcome: string }>(`/api/markets/${market.slug}/bet`, {
        amount: stake,
        outcome: open,
      });
      toast(`Bought ${formatShares(result.shares)} ${result.outcome} · now ${formatPercent(result.probAfter)}`);
      setOpen(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Bet failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`quick-yes-${market.slug}`}
          className={cn("btn-yes h-8 px-3 text-[13px]", open === "YES" && "ring-1 ring-yes")}
          onClick={() => setOpen(open === "YES" ? null : "YES")}
        >
          Yes {formatCents(market.probability)}
        </button>
        <button
          type="button"
          data-testid={`quick-no-${market.slug}`}
          className={cn("btn-no h-8 px-3 text-[13px]", open === "NO" && "ring-1 ring-no")}
          onClick={() => setOpen(open === "NO" ? null : "NO")}
        >
          No {formatCents(1 - market.probability)}
        </button>
      </div>
      {open && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            aria-label="Stake"
            data-testid={`quick-amount-${market.slug}`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="field h-8 w-24 num"
          />
          <button type="submit" disabled={pending} data-testid={`quick-confirm-${market.slug}`} className="btn-primary h-8 px-3 text-[13px]">
            {pending ? "Betting" : signedIn ? `Bet ${open}` : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
