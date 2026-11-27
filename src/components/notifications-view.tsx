"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client";
import { cn, formatDateTime } from "@/lib/format";
import type { NotificationView } from "@/lib/types";

export function NotificationsView({ items }: { items: NotificationView[] }) {
  const router = useRouter();

  async function read(id?: string, href?: string) {
    await postJson("/api/notifications/read", id ? { id } : {});
    if (href) router.push(href);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Notifications</h1>
        {items.some((item) => !item.read) && (
          <button type="button" onClick={() => void read()} className="text-sm text-secondary hover:text-ink">
            Mark all read
          </button>
        )}
      </div>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.length === 0 && <li className="px-4 py-8 text-sm text-secondary">Nothing yet. Trades, resolutions, and replies land here.</li>}
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => void read(item.id, item.href)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-pill">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-action")} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{item.title}</span>
                <span className="mt-0.5 block text-sm text-secondary">{item.body}</span>
                <span className="mt-1 block text-xs text-muted">{formatDateTime(item.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Or open a market from your <Link href="/portfolio" className="underline">portfolio</Link>.
      </p>
    </div>
  );
}
