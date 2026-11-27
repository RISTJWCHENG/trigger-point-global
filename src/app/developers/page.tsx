export const metadata = { title: "API reference" };

const samples = [
  {
    method: "GET",
    path: "/api/v0/markets",
    detail: "Newest liquid markets. Optional ?limit=20, capped at 50. Each row includes probability, pool reserves, liquidity, volume, and closeTime.",
  },
  {
    method: "GET",
    path: "/api/v0/market/fed-cuts-june-2027",
    detail: "One market, its answers, and the 20 most recent bets. Bets include side, amount, shares, and the probability before and after.",
  },
  {
    method: "GET",
    path: "/api/v0/user/demo",
    detail: "A public profile: name, bio, play-money balance, and follower counts. Passwords are never returned.",
  },
];

export default function DevelopersPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Developers</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">Read-only API</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-secondary">
        These routes are public. They describe the desk. They do not place bets, move TP, or reveal credentials.
      </p>
      <ul className="mt-6 space-y-3" data-testid="api-docs">
        {samples.map((sample) => (
          <li key={sample.path} className="surface p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">{sample.method}</span>
              <code className="text-sm text-ink">{sample.path}</code>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-secondary">{sample.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
