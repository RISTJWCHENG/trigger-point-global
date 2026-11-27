import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { cn, formatSignedTp, formatTp } from "@/lib/format";
import { getLeaderboard } from "@/lib/queries";

export const metadata = { title: "Leaderboard" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const windowParam = one(params.window);
  const window = windowParam === "week" || windowParam === "month" ? windowParam : "all";
  const metric = one(params.metric) === "volume" ? "volume" : "profit";
  const rows = await getLeaderboard(window, metric);

  function href(patch: { window?: string; metric?: string }) {
    const nextWindow = patch.window ?? window;
    const nextMetric = patch.metric ?? metric;
    const query = new URLSearchParams();
    if (nextWindow !== "all") query.set("window", nextWindow);
    if (nextMetric !== "profit") query.set("metric", nextMetric);
    const text = query.toString();
    return text ? `/leaderboard?${text}` : "/leaderboard";
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-medium tracking-tight">Leaderboard</h1>
      <p className="mt-1 text-sm text-secondary">
        All-time profit includes open positions at liquidation value. Weekly and monthly profit counts realized gains only.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg bg-pill p-0.5 text-sm">
          {(
            [
              ["all", "All-time"],
              ["week", "Weekly"],
              ["month", "Monthly"],
            ] as const
          ).map(([id, label]) => (
            <Link key={id} href={href({ window: id })} className={cn("rounded-md px-3 py-1.5", window === id ? "bg-card text-ink shadow-card" : "text-secondary")}>
              {label}
            </Link>
          ))}
        </div>
        <div className="flex rounded-lg bg-pill p-0.5 text-sm">
          {(
            [
              ["profit", "Profit"],
              ["volume", "Volume"],
            ] as const
          ).map(([id, label]) => (
            <Link key={id} href={href({ metric: id })} className={cn("rounded-md px-3 py-1.5", metric === id ? "bg-card text-ink shadow-card" : "text-secondary")}>
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="surface mt-4 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-3 py-3 font-medium">Trader</th>
              <th className="px-3 py-3 font-medium">Profit</th>
              <th className="px-4 py-3 font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.username} className="border-t border-line">
                <td className="num px-4 py-3 text-secondary">{row.rank}</td>
                <td className="px-3 py-3">
                  <Link href={`/profile/${row.user.username}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Avatar name={row.user.name} color={row.user.avatarColor} size={26} />
                    {row.user.name}
                    {row.user.isBot && <span className="rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-secondary">BOT</span>}
                  </Link>
                </td>
                <td className={cn("num px-3 py-3", row.profit >= 0 ? "text-yes" : "text-no")}>{formatSignedTp(row.profit)}</td>
                <td className="num px-4 py-3 text-secondary">{formatTp(row.volume, "compact")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-sm text-secondary">No trades in this window yet.</p>}
      </div>
    </div>
  );
}
