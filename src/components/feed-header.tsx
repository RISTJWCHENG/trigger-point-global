"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SORTS, TOPICS, TYPE_FILTERS } from "@/lib/constants";
import { cn } from "@/lib/format";

export type FeedQuery = {
  q: string;
  topic: string;
  sort: string;
  type: string;
  fy: string;
};

export function FeedHeader({ query, signedIn }: { query: FeedQuery; signedIn: boolean }) {
  const router = useRouter();

  function href(patch: Partial<FeedQuery>) {
    const next = { ...query, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.topic && next.topic !== "all") params.set("topic", next.topic);
    if (next.sort && next.sort !== "trending") params.set("sort", next.sort);
    if (next.type && next.type !== "all") params.set("type", next.type);
    params.set("fy", next.fy === "1" ? "1" : "0");
    return `/?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium tracking-tight text-ink">Markets</h1>
          <p className="text-sm text-secondary">Play-money forecasts, priced by a constant-product pool.</p>
        </div>
        {signedIn && (
          <div className="hidden rounded-lg bg-pill p-0.5 text-sm sm:flex">
            <Link href={href({ fy: "0" })} className={cn("rounded-md px-2.5 py-1", query.fy !== "1" ? "bg-card text-ink shadow-card" : "text-secondary")}>
              All
            </Link>
            <Link href={href({ fy: "1" })} className={cn("rounded-md px-2.5 py-1", query.fy === "1" ? "bg-card text-ink shadow-card" : "text-secondary")}>
              For you
            </Link>
          </div>
        )}
      </div>

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          router.push(href({ q: String(data.get("q") || "") }));
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search markets</span>
          <SearchIcon />
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Search markets"
            className="field h-11 pl-10 pr-14"
            data-testid="search"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium tracking-[0.08em] text-muted">
            ⌘K
          </span>
        </label>
      </form>

      <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {TOPICS.map((topic) => {
          const on = (query.topic || "all") === topic.id;
          return (
            <Link
              key={topic.id}
              href={href({ topic: topic.id })}
              data-testid={`topic-${topic.id}`}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition",
                on ? "bg-actionDeep text-[var(--action-ink)]" : "bg-pill text-secondary hover:text-ink",
              )}
            >
              {topic.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          label="Sort"
          value={query.sort || "trending"}
          testId="sort"
          options={SORTS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(sort) => router.push(href({ sort }))}
        />
        <Select
          label="Type"
          value={query.type || "all"}
          testId="type-filter"
          options={TYPE_FILTERS.map((item) => ({ value: item.id, label: item.label }))}
          onChange={(type) => router.push(href({ type }))}
        />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  testId: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-secondary">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm text-ink outline-none focus:border-action"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}
