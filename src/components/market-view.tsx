"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "./avatar";
import { CommentThread } from "./comment-thread";
import { BetPanel } from "./bet-panel";
import { ProbChart } from "./prob-chart";
import { RichText } from "./rich-text";
import { parseMarkdown } from "@/lib/markdown";
import { embedSnippet } from "@/lib/related";
import { useToast } from "./shell";
import { TOPICS } from "@/lib/constants";
import { postJson } from "@/lib/client";
import { cn, formatClose, formatDateTime, formatPercent, formatShares, formatTp, resolutionLabel } from "@/lib/format";
import type { MarketDetail } from "@/lib/types";
import type { ShellUser as Session } from "./shell";

export function MarketView({ market, user }: { market: MarketDetail; user: Session | null }) {
  const [sheet, setSheet] = useState(false);
  const [answerId, setAnswerId] = useState(
    [...market.answers].sort((a, b) => b.probability - a.probability)[0]?.id ?? "",
  );
  const topicId = TOPICS.find((topic) => topic.label === market.topic)?.id ?? "all";
  const leader = [...market.answers].sort((a, b) => b.probability - a.probability)[0];
  const headline = market.type !== "BINARY" && leader ? leader.probability : market.probability;
  const headlineLabel = market.type !== "BINARY" && leader ? leader.text : "chance";
  const resolved = resolutionLabel(market.resolution, market.resolutionProb, market.answers, market.type);
  const canResolve = Boolean(user && user.id === market.creatorId && !market.resolution);
  const blocked = Boolean(user && market.creatorBlocked && user.id === market.creatorId);
  const [subsidyOpen, setSubsidyOpen] = useState(false);

  return (
    <div className="mx-auto grid max-w-[1120px] gap-6 px-4 py-6 pb-36 lg:grid-cols-[minmax(0,1fr)_332px] lg:px-8 lg:pb-10">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
          <Avatar name={market.creator.name} color={market.creator.avatarColor} size={24} />
          <Link href={`/profile/${market.creator.username}`} className="font-medium text-ink hover:underline">
            {market.creator.name}
          </Link>
          <span className="text-muted">·</span>
          <Link href={`/?topic=${topicId}&fy=0`} className="hover:text-ink">
            {market.topic}
          </Link>
          <span className="text-muted">·</span>
          <span>{market.type === "BINARY" ? "Binary" : market.type === "POLL" ? "Poll" : "Multiple choice"}</span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-tight text-ink">{market.question}</h1>
          <div className="shrink-0 text-right">
            <div className="figure num text-4xl font-medium leading-none tracking-tight" data-testid="market-probability">
              {formatPercent(headline, headline > 0.995 || headline < 0.015 ? 0 : 1)}
            </div>
            <div className="mt-1 max-w-[120px] truncate text-[11px] uppercase tracking-wide text-muted">{headlineLabel}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
          <span className="num">{formatTp(market.volume, "compact")} TP volume</span>
          <span className="num" data-testid="market-liquidity">{formatTp(market.liquidity, "compact")} TP liquidity</span>
          <span className="num">{market.traders} traders</span>
          <span>{formatClose(market.closeAt)}</span>
          {market.type !== "POLL" && !market.resolution && user && (
            <button type="button" className="text-ink underline decoration-line underline-offset-2" data-testid="add-liquidity" onClick={() => setSubsidyOpen(true)}>
              Add liquidity
            </button>
          )}
          {resolved && <span className="rounded-full bg-pill px-2.5 py-0.5 text-xs font-medium text-ink">{resolved}</span>}
        </div>
        <Actions market={market} user={user} canResolve={canResolve} />
        {market.type !== "POLL" && (
          <div className="surface mt-5 p-4">
            <ProbChart
              points={market.points}
              answers={market.answers}
              type={market.type}
              markers={
                user
                  ? market.trades
                      .filter((trade) => trade.user.username === user.username && trade.side !== "SUBSIDY")
                      .map((trade) => ({
                        t: new Date(trade.createdAt).getTime(),
                        p: trade.probAfter,
                        side: trade.side,
                        outcome: trade.outcome,
                        amount: trade.amount,
                      }))
                  : []
              }
            />
          </div>
        )}
        <Description text={market.description} />
        {market.creatorBlocked && (
          <p className="mt-3 text-sm text-secondary" data-testid="creator-block-notice">
            The creator has blocked themselves from betting in this market.
          </p>
        )}
        {market.type === "MULTIPLE" && !market.resolution && (
          <OutcomeBoard market={market} selected={answerId} onSelect={setAnswerId} />
        )}
        {market.type === "POLL" && <PollBoard market={market} signedIn={Boolean(user)} />}
        {market.type === "BINARY" && <OrderBook book={market.orderBook} />}
        <Tabs market={market} signedIn={Boolean(user)} />
        {market.related.length > 0 && (
          <section className="mt-6" data-testid="related-markets">
            <h2 className="text-sm font-medium text-ink">Related markets</h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
              {market.related.map((item) => (
                <li key={item.slug}>
                  <Link href={`/market/${item.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-pill">
                    <span className="min-w-0 truncate text-ink">{item.question}</span>
                    <span className="num shrink-0 rounded-full bg-pill px-2 py-0.5 text-xs text-ink">{formatPercent(item.probability)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {market.type !== "POLL" && (
      <aside className="hidden lg:block">
        <div className="sticky top-6">
          <BetPanel
            market={market}
            balance={user?.balance ?? null}
            signedIn={Boolean(user)}
            selectedAnswerId={answerId}
            onSelectAnswer={setAnswerId}
            blocked={blocked}
          />
        </div>
      </aside>
      )}

      {market.type !== "POLL" && !market.resolution && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-canvas px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div>
              <div className="num text-xl font-medium leading-none">{formatPercent(headline)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">chance</div>
            </div>
            <button type="button" className="btn-primary h-11 flex-1" onClick={() => setSheet(true)} data-testid="mobile-trade">
              Trade
            </button>
          </div>
        </div>
      )}
      {sheet && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label="Close trade panel" className="absolute inset-0 scrim" onClick={() => setSheet(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-2xl bg-canvas p-4 pb-6 shadow-sheet">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Trade</h2>
              <button type="button" className="text-sm text-secondary" onClick={() => setSheet(false)}>
                Close
              </button>
            </div>
            <BetPanel
              market={market}
              balance={user?.balance ?? null}
              signedIn={Boolean(user)}
              selectedAnswerId={answerId}
              onSelectAnswer={setAnswerId}
              blocked={blocked}
            />
          </div>
        </div>
      )}
      {subsidyOpen && <SubsidyModal slug={market.slug} balance={user?.balance ?? 0} onClose={() => setSubsidyOpen(false)} />}
    </div>
  );
}

function Description({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  const long = text.length > 280;
  const [open, setOpen] = useState(false);
  const shown = long && !open ? blocks.slice(0, 2) : blocks;
  return (
    <section className="surface mt-4 p-4" data-testid="resolution-criteria">
      {shown.length ? <RichText blocks={shown} /> : <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{text}</p>}
      {long && (
        <button type="button" className="mt-3 text-sm text-ink underline decoration-line underline-offset-2" data-testid="description-toggle" onClick={() => setOpen((value) => !value)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </section>
  );
}

function SubsidyModal({ slug, balance, onClose }: { slug: string; balance: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState("50");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setPending(true);
    setError(null);
    try {
      await postJson(`/api/markets/${slug}/liquidity`, { amount: Number(amount) });
      toast("Liquidity added");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add liquidity");
      setPending(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close add liquidity" className="absolute inset-0 scrim" onClick={onClose} />
      <div className="surface relative z-10 w-full max-w-sm p-4" data-testid="liquidity-modal">
        <h2 className="text-sm font-medium text-ink">Add liquidity</h2>
        <p className="mt-1 text-sm text-secondary">This deepens the pool and leaves the probability where it is. You have {formatTp(balance)} TP.</p>
        <input data-testid="liquidity-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="field num mt-3" />
        {error && <p className="mt-2 text-sm text-no">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" data-testid="liquidity-submit" disabled={pending} onClick={() => void submit()}>
            {pending ? "Adding" : "Add liquidity"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderBook({ book }: { book: MarketDetail["orderBook"] }) {
  return (
    <section className="surface mt-4 p-4" data-testid="order-book">
      <h2 className="text-sm font-medium text-ink">Order book</h2>
      <p className="mt-0.5 text-xs text-muted">Resting limit orders from every trader, best price first.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <BookSide title="YES bids" rows={book.yes} tone="yes" />
        <BookSide title="NO bids" rows={book.no} tone="no" />
      </div>
    </section>
  );
}

function BookSide({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: MarketDetail["orderBook"]["yes"];
  tone: "yes" | "no";
}) {
  return (
    <div>
      <h3 className={cn("text-xs font-medium uppercase tracking-wide", tone === "yes" ? "text-yes" : "text-no")}>{title}</h3>
      <ul className="mt-2 divide-y divide-line">
        {rows.length === 0 && <li className="py-2 text-sm text-muted">No resting orders</li>}
        {rows.map((row) => (
          <li key={`${tone}-${row.limitProb}`} className="flex items-center justify-between py-1.5 text-sm">
            <span className="num">{formatPercent(row.limitProb, 1)}</span>
            <span className="num text-secondary">{formatTp(row.amount)} TP</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PollBoard({ market, signedIn }: { market: MarketDetail; signedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const total = market.answers.reduce((sum, answer) => sum + answer.votes, 0);
  async function vote(answerId: string) {
    if (!signedIn) {
      router.push(`/signin?next=/market/${market.slug}`);
      return;
    }
    setPending(answerId);
    try {
      await postJson(`/api/markets/${market.slug}/vote`, { answerId });
      toast(market.myVote ? "Vote updated" : "Vote counted");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vote failed");
    } finally {
      setPending(null);
    }
  }
  return (
    <section className="surface mt-4 divide-y divide-line" data-testid="poll-board">
      <div className="px-4 py-3 text-sm text-secondary">{total} {total === 1 ? "vote" : "votes"}. You can change yours until the poll closes.</div>
      {market.answers.map((answer) => (
        <div key={answer.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{answer.text}</span>
              <span className="num text-secondary">
                {formatPercent(answer.probability, 1)} · {answer.votes}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pill">
              <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(answer.votes ? 2 : 0, answer.probability * 100)}%` }} />
            </div>
          </div>
          <button
            type="button"
            data-testid={`vote-${answer.id}`}
            disabled={pending === answer.id}
            onClick={() => void vote(answer.id)}
            className={cn("btn h-8 shrink-0 px-3 text-xs", market.myVote === answer.id ? "btn-primary" : "border border-line bg-card text-ink")}
          >
            {market.myVote === answer.id ? "Your vote" : "Vote"}
          </button>
        </div>
      ))}
    </section>
  );
}

function OutcomeBoard({
  market,
  selected,
  onSelect,
}: {
  market: MarketDetail;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const ranked = [...market.answers].sort((a, b) => b.probability - a.probability);
  return (
    <section className="surface mt-4 divide-y divide-line" data-testid="outcome-board">
      {ranked.map((answer) => (
        <div key={answer.id} className={cn("flex items-center gap-3 px-4 py-3", selected === answer.id && "bg-pill")}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{answer.text}</span>
              <span className="num shrink-0">{formatPercent(answer.probability, 1)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pill">
              <div className="h-full rounded-full bg-action" style={{ width: `${Math.max(1.5, answer.probability * 100)}%` }} />
            </div>
          </div>
          <button
            type="button"
            data-testid={`answer-${answer.id}`}
            onClick={() => onSelect(answer.id)}
            className={cn("btn-yes h-8 shrink-0 px-3 text-xs", selected === answer.id && "ring-1 ring-yes")}
          >
            Yes
          </button>
        </div>
      ))}
    </section>
  );
}

function Actions({ market, user, canResolve }: { market: MarketDetail; user: Session | null; canResolve: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(market.bookmarked);

  async function bookmark() {
    if (!user) {
      router.push(`/signin?next=/market/${market.slug}`);
      return;
    }
    const result = await postJson<{ saved: boolean }>(`/api/markets/${market.slug}/bookmark`);
    setSaved(result.saved);
    toast(result.saved ? "Saved to your portfolio" : "Removed from saved");
  }

  async function copy(text: string, message: string) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand("copy");
      area.remove();
    }
    toast(copied ? message : "Could not copy from this browser");
    if (copied) setShareOpen(false);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void bookmark()} className="btn h-8 border border-line bg-card px-3 text-xs text-ink hover:bg-pill">
          {saved ? "Saved" : "Save"}
        </button>
        <div className="relative">
          <button type="button" data-testid="share-open" onClick={() => setShareOpen((value) => !value)} className="btn h-8 border border-line bg-card px-3 text-xs text-ink hover:bg-pill">
            Share
          </button>
          {shareOpen && (
            <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl border border-line bg-card p-1 shadow-card" data-testid="share-menu">
              <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-pill" data-testid="share-link" onClick={() => void copy(window.location.href, "Link copied")}>
                Copy link
              </button>
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-pill"
                data-testid="share-embed"
                onClick={() => void copy(embedSnippet(window.location.origin, market.slug), "Embed code copied")}
              >
                Copy embed code
              </button>
            </div>
          )}
        </div>
        {canResolve && (
          <button type="button" data-testid="resolve-open" onClick={() => setOpen(true)} className="btn-primary h-8 px-3 text-xs">
            Resolve
          </button>
        )}
      </div>
      {open && <ResolveModal market={market} onClose={() => setOpen(false)} />}
    </>
  );
}

function ResolveModal({ market, onClose }: { market: MarketDetail; onClose: () => void }) {
  const router = useRouter();
  const [choice, setChoice] = useState(market.type === "BINARY" ? "YES" : market.answers[0]?.id ?? "CANCEL");
  const [percent, setPercent] = useState(50);
  const [weights, setWeights] = useState<Record<string, string>>(Object.fromEntries(market.answers.map((answer) => [answer.id, ""])));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      let body: Record<string, unknown> = { note };
      if (market.type === "BINARY") {
        if (choice === "MKT") body = { resolution: "MKT", probability: percent / 100, note };
        else body = { resolution: choice, note };
      } else if (choice === "CANCEL") {
        body = { resolution: "CANCEL", note };
      } else if (choice === "MKT") {
        body = { resolution: "MKT_MULTI", weights: Object.fromEntries(market.answers.map((answer) => [answer.id, Number(weights[answer.id] || 0)])), note };
      } else {
        body = { resolution: "ANSWER", answerId: choice, note };
      }
      await postJson(`/api/markets/${market.slug}/resolve`, body);
      onClose();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resolve");
    } finally {
      setPending(false);
    }
  }

  const binaryChoices = [
    { id: "YES", label: "YES" },
    { id: "NO", label: "NO" },
    { id: "MKT", label: "Percentage" },
    { id: "CANCEL", label: "N/A cancel" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center scrim p-4 sm:items-center">
      <div className="surface w-full max-w-md p-5" role="dialog" aria-labelledby="resolve-title">
        <h2 id="resolve-title" className="text-lg font-medium">Resolve market</h2>
        <p className="mt-1 text-sm text-secondary">This settles every position and cannot be undone.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(market.type === "BINARY" ? binaryChoices : []).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`resolve-${item.id.toLowerCase()}`}
              onClick={() => setChoice(item.id)}
              className={cn("rounded-lg border px-3 py-2 text-sm", choice === item.id ? "border-action bg-pill text-ink" : "border-line text-secondary")}
            >
              {item.label}
            </button>
          ))}
          {market.type === "MULTIPLE" &&
            market.answers.map((answer) => (
              <button
                key={answer.id}
                type="button"
                onClick={() => setChoice(answer.id)}
                className={cn("rounded-lg border px-3 py-2 text-left text-sm", choice === answer.id ? "border-action bg-pill text-ink" : "border-line text-secondary")}
              >
                {answer.text}
              </button>
            ))}
          {market.type === "MULTIPLE" && (
            <>
              <button type="button" onClick={() => setChoice("MKT")} className={cn("rounded-lg border px-3 py-2 text-sm", choice === "MKT" ? "border-action bg-pill" : "border-line text-secondary")}>
                Split
              </button>
              <button type="button" data-testid="resolve-cancel" onClick={() => setChoice("CANCEL")} className={cn("rounded-lg border px-3 py-2 text-sm", choice === "CANCEL" ? "border-action bg-pill" : "border-line text-secondary")}>
                N/A cancel
              </button>
            </>
          )}
        </div>
        {market.type === "BINARY" && choice === "MKT" && (
          <label className="mt-4 block text-sm text-secondary">
            YES pays {percent}%
            <input type="range" min={0} max={100} value={percent} onChange={(event) => setPercent(Number(event.target.value))} className="mt-2 w-full" />
          </label>
        )}
        {market.type === "MULTIPLE" && choice === "MKT" && (
          <div className="mt-4 space-y-2">
            {market.answers.map((answer) => (
              <label key={answer.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-secondary">{answer.text}</span>
                <input
                  value={weights[answer.id]}
                  onChange={(event) => setWeights((current) => ({ ...current, [answer.id]: event.target.value }))}
                  inputMode="decimal"
                  className="field num w-24"
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        )}
        <label className="mt-4 block text-sm text-secondary">
          Note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="field mt-1 min-h-20" placeholder="Optional resolution note" />
        </label>
        {error && <p className="mt-3 text-sm text-no">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Back
          </button>
          <button type="button" data-testid="resolve-confirm" disabled={pending} onClick={() => void confirm()} className="btn-primary">
            {pending ? "Resolving" : "Resolve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tabs({ market, signedIn }: { market: MarketDetail; signedIn: boolean }) {
  const [tab, setTab] = useState<"comments" | "activity" | "holders" | "about">("comments");
  const tabs = [
    ["comments", "Comments"],
    ["activity", "Activity"],
    ["holders", "Holders"],
    ["about", "About"],
  ] as const;
  return (
    <section className="mt-5">
      <div className="flex gap-4 border-b border-line">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("border-b-2 pb-2 text-sm", tab === id ? "border-action text-ink" : "border-transparent text-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tab === "comments" && <Comments market={market} signedIn={signedIn} />}
        {tab === "activity" && <Activity market={market} />}
        {tab === "holders" && <Holders market={market} />}
        {tab === "about" && <About market={market} />}
      </div>
    </section>
  );
}

function Comments({ market, signedIn }: { market: MarketDetail; signedIn: boolean }) {
  return <CommentThread market={market} signedIn={signedIn} />;
}

function Activity({ market }: { market: MarketDetail }) {
  if (market.trades.length === 0) return <p className="text-sm text-secondary">No trades yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {market.trades.map((trade) => (
        <li key={trade.id} className="flex items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Avatar name={trade.user.name} color={trade.user.avatarColor} size={22} />
              <Link href={`/profile/${trade.user.username}`} className="font-medium hover:underline">
                {trade.user.name}
              </Link>
              {trade.user.isBot && <span className="rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-secondary">BOT</span>}
              <span className="text-secondary">
                {trade.side === "SUBSIDY" ? "added liquidity" : `${trade.side === "BUY" ? "bought" : "sold"} ${trade.outcome}`}
              </span>
            </div>
            <div className="mt-1 pl-7 text-xs text-muted">{formatDateTime(trade.createdAt)}</div>
          </div>
          <div className="num text-right">
            <div>{formatTp(trade.amount)} TP</div>
            <div className="text-xs text-secondary">
              {formatPercent(trade.probBefore, 1)} → {formatPercent(trade.probAfter, 1)}
            </div>
            {trade.side !== "SUBSIDY" && <div className="text-xs text-muted">{formatShares(trade.shares)} shares</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Holders({ market }: { market: MarketDetail }) {
  if (market.holders.length === 0) return <p className="text-sm text-secondary">No open positions.</p>;
  if (market.type === "BINARY") {
    const yes = market.holders.filter((holder) => holder.side === "YES");
    const no = market.holders.filter((holder) => holder.side === "NO");
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <HolderColumn title="YES" rows={yes} tone="yes" />
        <HolderColumn title="NO" rows={no} tone="no" />
      </div>
    );
  }
  const groups = new Map<string, typeof market.holders>();
  for (const holder of market.holders) {
    const list = groups.get(holder.side) ?? [];
    list.push(holder);
    groups.set(holder.side, list);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([side, rows]) => (
        <HolderColumn key={side} title={side} rows={rows.slice(0, 6)} tone="yes" />
      ))}
    </div>
  );
}

function HolderColumn({ title, rows, tone }: { title: string; rows: MarketDetail["holders"]; tone: "yes" | "no" }) {
  return (
    <div>
      <h3 className={cn("text-xs font-medium uppercase tracking-wide", tone === "no" ? "text-no" : "text-yes")}>{title}</h3>
      <ul className="mt-2 divide-y divide-line">
        {rows.length === 0 && <li className="py-2 text-sm text-muted">None yet</li>}
        {rows.slice(0, 8).map((holder) => (
          <li key={`${holder.user.username}-${holder.side}`} className="flex items-center justify-between gap-3 py-2 text-sm">
            <Link href={`/profile/${holder.user.username}`} className="flex items-center gap-2 hover:underline">
              <Avatar name={holder.user.name} color={holder.user.avatarColor} size={22} />
              {holder.user.name}
              {holder.user.isBot && <span className="rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-secondary">BOT</span>}
            </Link>
            <span className="num text-secondary">{formatShares(holder.shares)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function About({ market }: { market: MarketDetail }) {
  return (
    <div className="max-w-2xl">
      <h3 className="text-sm font-medium text-ink">Resolution criteria</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary">{market.description}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Created" value={formatDateTime(market.createdAt)} />
        <Stat label="Closes" value={formatDateTime(market.closeAt)} />
        <Stat label="Liquidity ante" value={`${formatTp(market.ante)} TP`} />
        <Stat label="Pool cash" value={`${formatTp(market.pot)} TP`} />
        <Stat label="Volume" value={`${formatTp(market.volume)} TP`} />
        <Stat label="Traders" value={String(market.traders)} />
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Binary prices use a CPMM-1 pool. Multiple-choice prices use a fixed-product pool whose outcome odds sum to 100%. There is no trading fee. TP is play money.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-pill px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="num mt-1 text-ink">{value}</dd>
    </div>
  );
}
