import Link from "next/link";
import { formatTp } from "@/lib/format";
import { getTopics } from "@/lib/queries";

export const metadata = { title: "Topics" };

export default async function TopicsPage() {
  const topics = await getTopics();
  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-medium tracking-tight">Topics</h1>
      <p className="mt-1 text-sm text-secondary">Browse the desk by the question, not the crowd.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => (
          <Link key={topic.id} href={`/?topic=${topic.id}&fy=0`} className="surface p-4 transition hover:border-secondary/30">
            <h2 className="font-medium">{topic.label}</h2>
            <p className="mt-1 text-sm text-secondary">{topic.blurb}</p>
            <p className="mt-3 text-xs text-muted">
              <span className="num text-secondary">{topic.open} open</span>
              <span> · </span>
              <span className="num">{topic.count} total</span>
              <span> · </span>
              <span className="num">{formatTp(topic.volume, "compact")} TP</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
