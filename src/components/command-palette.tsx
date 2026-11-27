"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TOPICS } from "@/lib/constants";
import { formatPercent } from "@/lib/format";

type HitMarket = { slug: string; question: string; probability: number; topic: string };
type HitUser = { username: string; name: string };

const THEMES = [
  { id: "atelier", label: "Atelier" },
  { id: "stone", label: "Stone" },
  { id: "charcoal", label: "Charcoal" },
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<HitMarket[]>([]);
  const [users, setUsers] = useState<HitUser[]>([]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      const q = query.trim();
      if (!q) {
        setMarkets([]);
        setUsers([]);
        return;
      }
      void fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((response) => response.json())
        .then((data: { markets?: HitMarket[]; users?: HitUser[] }) => {
          setMarkets(data.markets ?? []);
          setUsers(data.users ?? []);
        })
        .catch(() => {
          setMarkets([]);
          setUsers([]);
        });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const topics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOPICS.filter((topic) => topic.id !== "all" && (!q || topic.label.toLowerCase().includes(q))).slice(0, 6);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function setTheme(id: (typeof THEMES)[number]["id"]) {
    document.documentElement.dataset.theme = id;
    localStorage.setItem("tpg-theme", id);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      <button type="button" aria-label="Close search" className="absolute inset-0 scrim" onClick={() => setOpen(false)} />
      <div className="surface relative z-10 w-full max-w-lg overflow-hidden" role="dialog" aria-label="Quick search" data-testid="command-palette">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Markets, traders, topics, actions"
          className="field rounded-none border-0 border-b border-line"
          data-testid="command-input"
        />
        <div className="max-h-[50vh] overflow-auto p-2 text-sm">
          <Section title="Actions">
            <Row label="Create market" hint="New question" onClick={() => go("/create")} />
            <Row label="Portfolio" hint="Your desk" onClick={() => go("/portfolio")} />
            <Row label="Leaderboard" hint="Profit and volume" onClick={() => go("/leaderboard")} />
            {THEMES.map((theme) => (
              <Row key={theme.id} label={`Theme · ${theme.label}`} hint="Switch look" onClick={() => setTheme(theme.id)} testId={`palette-theme-${theme.id}`} />
            ))}
          </Section>
          {topics.length > 0 && (
            <Section title="Topics">
              {topics.map((topic) => (
                <Row key={topic.id} label={topic.label} hint="Topic" onClick={() => go(`/?topic=${topic.id}&fy=0`)} />
              ))}
            </Section>
          )}
          {markets.length > 0 && (
            <Section title="Markets">
              {markets.map((market) => (
                <Row
                  key={market.slug}
                  label={market.question}
                  hint={formatPercent(market.probability)}
                  onClick={() => go(`/market/${market.slug}`)}
                />
              ))}
            </Section>
          )}
          {users.length > 0 && (
            <Section title="Traders">
              {users.map((user) => (
                <Row key={user.username} label={user.name} hint={`@${user.username}`} onClick={() => go(`/profile/${user.username}`)} />
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, hint, onClick, testId }: { label: string; hint: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-pill">
      <span className="min-w-0 truncate text-ink">{label}</span>
      <span className="shrink-0 text-xs text-muted">{hint}</span>
    </button>
  );
}
