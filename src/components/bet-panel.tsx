"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QUICK_AMOUNTS } from "@/lib/constants";
import { postJson } from "@/lib/client";
import { buyBinary, buyMulti, sellBinary, sellMulti } from "@/lib/cpmm";
import { cn, formatCents, formatPercent, formatShares, formatSignedTp, formatTp, resolutionLabel } from "@/lib/format";
import type { MarketDetail } from "@/lib/types";

type Preview = {
  shares: number;
  before: number;
  after: number;
  cost: number;
  payout: number;
  proceeds?: number;
  pnl?: number;
};

export function BetPanel({
  market,
  balance,
  signedIn,
}: {
  market: MarketDetail;
  balance: number | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [answerId, setAnswerId] = useState(
    [...market.answers].sort((a, b) => b.probability - a.probability)[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("50");
  const [shareText, setShareText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const binaryHolding = market.holdings.find((holding) => holding.answerId === "") ?? null;
  const answerHolding = market.holdings.find((holding) => holding.answerId === answerId) ?? null;
  const heldShares =
    market.type === "BINARY"
      ? outcome === "YES"
        ? binaryHolding?.sharesYes ?? 0
        : binaryHolding?.sharesNo ?? 0
      : answerHolding?.shares ?? 0;
  const heldBasis =
    market.type === "BINARY"
      ? outcome === "YES"
        ? binaryHolding?.costBasisYes ?? 0
        : binaryHolding?.costBasisNo ?? 0
      : answerHolding?.costBasisYes ?? 0;

  const stake = Number(amount);
  const selling = shareText === "" ? 0 : Number(shareText);

  const preview = useMemo(() => {
    try {
      if (market.resolution) return null;
      if (side === "BUY") {
        if (!(stake >= 1)) return null;
        if (market.type === "BINARY") {
          const trade = buyBinary({ yes: market.poolYes, no: market.poolNo, p: market.p }, outcome, stake);
          return { shares: trade.shares, before: trade.probBefore, after: trade.probAfter, cost: stake, payout: trade.shares } satisfies Preview;
        }
        const index = market.answers.findIndex((answer) => answer.id === answerId);
        if (index < 0) return null;
        const trade = buyMulti({ pools: market.answers.map((answer) => answer.pool) }, index, stake);
        return {
          shares: trade.shares,
          before: trade.probsBefore[index],
          after: trade.probsAfter[index],
          cost: stake,
          payout: trade.shares,
        } satisfies Preview;
      }
      if (!(selling > 0) || !(heldShares > 0)) return null;
      const shares = Math.min(selling, heldShares);
      if (market.type === "BINARY") {
        const trade = sellBinary({ yes: market.poolYes, no: market.poolNo, p: market.p }, outcome, shares);
        const avg = heldShares > 0 ? heldBasis / heldShares : 0;
        return {
          shares,
          before: trade.probBefore,
          after: trade.probAfter,
          cost: avg * shares,
          payout: trade.proceeds,
          proceeds: trade.proceeds,
          pnl: trade.proceeds - avg * shares,
        } satisfies Preview;
      }
      const index = market.answers.findIndex((answer) => answer.id === answerId);
      if (index < 0) return null;
      const trade = sellMulti({ pools: market.answers.map((answer) => answer.pool) }, index, shares);
      const avg = heldShares > 0 ? heldBasis / heldShares : 0;
      return {
        shares,
        before: trade.probsBefore[index],
        after: trade.probsAfter[index],
        cost: avg * shares,
        payout: trade.proceeds,
        proceeds: trade.proceeds,
        pnl: trade.proceeds - avg * shares,
      } satisfies Preview;
    } catch {
      return null;
    }
  }, [answerId, heldBasis, heldShares, market, outcome, selling, side, stake]);

  const resolved = resolutionLabel(market.resolution, market.resolutionProb, market.answers, market.type);
  const payoutLabel = market.type === "BINARY" ? `Payout if ${outcome}` : "Payout if chosen";

  async function submit() {
    setError(null);
    setNote(null);
    if (!signedIn) {
      router.push(`/signin?next=/market/${market.slug}`);
      return;
    }
    setPending(true);
    try {
      if (side === "BUY") {
        const result = await postJson<{ shares: number; probAfter: number; outcome: string; balance: number }>(
          `/api/markets/${market.slug}/bet`,
          { amount: stake, outcome: market.type === "BINARY" ? outcome : undefined, answerId: market.type === "MULTIPLE" ? answerId : undefined },
        );
        setNote(`Filled ${formatShares(result.shares)} ${result.outcome} · now ${formatPercent(result.probAfter, 1)}`);
        setAmount("50");
      } else {
        const result = await postJson<{ amount: number; probAfter: number; realizedPnl: number }>(`/api/markets/${market.slug}/sell`, {
          shares: Math.min(selling, heldShares),
          outcome: market.type === "BINARY" ? outcome : undefined,
          answerId: market.type === "MULTIPLE" ? answerId : undefined,
        });
        setNote(`Sold for ${formatTp(result.amount)} TP · ${formatSignedTp(result.realizedPnl)} realized`);
        setShareText("");
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Trade failed");
    } finally {
      setPending(false);
    }
  }

  if (resolved) {
    return (
      <section className="surface p-4">
        <h2 className="text-sm font-medium text-ink">{resolved}</h2>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Trading is closed. Winning shares paid 1 TP each, a percentage resolution paid the stated fraction, and a cancellation returned net stakes.
        </p>
        {market.resolutionNote && <p className="mt-3 text-sm text-ink">{market.resolutionNote}</p>}
      </section>
    );
  }

  return (
    <section className="surface p-4" data-testid="bet-panel">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-pill p-1 text-sm">
        {(["BUY", "SELL"] as const).map((item) => (
          <button
            key={item}
            type="button"
            data-testid={item === "BUY" ? "side-buy" : "side-sell"}
            onClick={() => {
              setSide(item);
              setError(null);
              if (item === "SELL" && market.type === "MULTIPLE") {
                const held = market.holdings.find((holding) => holding.shares > 0.01);
                if (held) setAnswerId(held.answerId);
              }
              if (item === "SELL" && market.type === "BINARY") {
                const holding = market.holdings.find((itemHolding) => itemHolding.answerId === "");
                if (holding && holding.sharesYes <= 0.01 && holding.sharesNo > 0.01) setOutcome("NO");
                if (holding && holding.sharesNo <= 0.01 && holding.sharesYes > 0.01) setOutcome("YES");
              }
            }}
            className={cn("rounded-md py-1.5", side === item ? "bg-white font-medium text-ink shadow-card" : "text-secondary")}
          >
            {item === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {market.type === "BINARY" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="outcome-yes"
            onClick={() => setOutcome("YES")}
            className={cn("btn-yes", outcome === "YES" ? "ring-1 ring-yes" : "opacity-70")}
          >
            Yes {formatCents(market.probability)}
          </button>
          <button
            type="button"
            data-testid="outcome-no"
            onClick={() => setOutcome("NO")}
            className={cn("btn-no", outcome === "NO" ? "ring-1 ring-no" : "opacity-70")}
          >
            No {formatCents(1 - market.probability)}
          </button>
        </div>
      ) : (
        <div className="mt-3 max-h-80 space-y-1 overflow-auto pr-1">
          {market.answers.map((answer) => {
            const selected = answer.id === answerId;
            const owned = market.holdings.find((holding) => holding.answerId === answer.id)?.shares ?? 0;
            if (side === "SELL" && owned <= 0.01) return null;
            return (
              <button
                key={answer.id}
                type="button"
                data-testid={`answer-${answer.id}`}
                onClick={() => setAnswerId(answer.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm",
                  selected ? "border-action bg-white" : "border-transparent bg-pill/70 hover:bg-pill",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{answer.text}</span>
                <span className="num text-ink">{formatPercent(answer.probability)}</span>
              </button>
            );
          })}
        </div>
      )}

      {side === "BUY" ? (
        <>
          <label className="mt-4 block text-xs text-secondary">
            Amount
            <span className="relative mt-1 block">
              <input
                data-testid="bet-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="field num pr-10 text-base"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">TP</span>
            </span>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  Number(amount) === value ? "bg-actionDeep text-white" : "bg-pill text-secondary hover:text-ink",
                )}
              >
                {value}
              </button>
            ))}
            {balance !== null && (
              <button type="button" onClick={() => setAmount(String(Math.floor(balance)))} className="rounded-full bg-pill px-2.5 py-1 text-xs text-secondary">
                Max
              </button>
            )}
          </div>
        </>
      ) : heldShares <= 0.01 ? (
        <p className="mt-4 text-sm text-secondary">You don&apos;t have shares on this side yet.</p>
      ) : (
        <>
          <label className="mt-4 block text-xs text-secondary">
            Shares to sell
            <span className="mt-0.5 block text-[11px] text-muted">You hold {formatShares(heldShares)}</span>
            <input
              data-testid="sell-amount"
              value={shareText}
              onChange={(event) => setShareText(event.target.value)}
              inputMode="decimal"
              className="field num mt-1 text-base"
            />
          </label>
          <div className="mt-2 flex gap-1.5">
            {[0.25, 0.5, 1].map((part) => (
              <button
                key={part}
                type="button"
                onClick={() => setShareText(String(Math.floor(heldShares * part * 1000) / 1000))}
                className="rounded-full bg-pill px-2.5 py-1 text-xs text-secondary hover:text-ink"
              >
                {part === 1 ? "Max" : `${part * 100}%`}
              </button>
            ))}
          </div>
        </>
      )}

      {preview && (
        <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
          <Line label={side === "BUY" ? "Avg price" : "Proceeds"} value={side === "BUY" ? formatCents(preview.cost / preview.shares) : `${formatTp(preview.proceeds ?? 0)} TP`} />
          <Line label="Shares" value={formatShares(preview.shares)} />
          <Line
            label="Probability"
            value={`${formatPercent(preview.before, 1)} → ${formatPercent(preview.after, 1)}`}
          />
          {side === "BUY" ? (
            <>
              <Line label={payoutLabel} value={`${formatTp(preview.payout)} TP`} />
              <Line label="Profit if right" value={`${formatSignedTp(preview.payout - preview.cost)} TP`} tone={preview.payout - preview.cost} />
              <Line label="ROI" value={`${preview.payout - preview.cost >= 0 ? "+" : ""}${(((preview.payout - preview.cost) / preview.cost) * 100).toFixed(0)}%`} tone={preview.payout - preview.cost} />
            </>
          ) : (
            <Line label="Realized P&L" value={`${formatSignedTp(preview.pnl ?? 0)} TP`} tone={preview.pnl ?? 0} />
          )}
        </dl>
      )}

      {balance !== null && side === "BUY" && stake > balance + 1e-6 && (
        <p className="mt-3 text-sm text-no">Not enough TP in your balance.</p>
      )}
      {error && <p className="mt-3 text-sm text-no">{error}</p>}
      {note && <p className="mt-3 text-sm text-yes" data-testid="trade-note">{note}</p>}

      {signedIn ? (
        <button
          type="button"
          data-testid="bet-submit"
          disabled={pending || !preview || (side === "BUY" && balance !== null && stake > balance + 1e-6)}
          onClick={() => void submit()}
          className="btn-primary mt-4 h-11 w-full"
        >
          {pending ? "Submitting" : side === "BUY" ? `Buy ${market.type === "BINARY" ? outcome : "shares"}` : "Sell shares"}
        </button>
      ) : (
        <Link href={`/signin?next=/market/${market.slug}`} className="btn-primary mt-4 h-11 w-full">
          Sign in to trade
        </Link>
      )}
      {balance !== null && (
        <p className="mt-2 text-center text-xs text-muted">
          Balance <span className="num text-secondary">{formatTp(balance)} TP</span>
        </p>
      )}
    </section>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: number }) {
  const color = tone === undefined ? "text-ink" : tone > 0.004 ? "text-yes" : tone < -0.004 ? "text-no" : "text-ink";
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className={cn("num font-medium", color)}>{value}</dd>
    </div>
  );
}
