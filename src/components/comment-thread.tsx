"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "./avatar";
import { postJson } from "@/lib/client";
import { cn, formatDateTime } from "@/lib/format";
import type { CommentView, MarketDetail } from "@/lib/types";

function BotBadge() {
  return <span className="rounded-full bg-pill px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-secondary">BOT</span>;
}

export function CommentThread({ market, signedIn }: { market: MarketDetail; signedIn: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [sort, setSort] = useState<"newest" | "oldest" | "liked">("newest");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const roots = useMemo(() => {
    const copy = [...market.comments];
    if (sort === "oldest") return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === "liked") return copy.sort((a, b) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt));
    return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [market.comments, sort]);

  function startReply(id: string, username: string) {
    setReplyTo({ id, username });
    setBody((current) => (current.startsWith(`@${username}`) ? current : `@${username} ${current}`.trimStart()));
  }

  async function submit() {
    if (!signedIn) {
      router.push(`/signin?next=/market/${market.slug}`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await postJson(`/api/markets/${market.slug}/comments`, { body, parentId: replyTo?.id });
      setBody("");
      setReplyTo(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not post");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1 text-xs" data-testid="comment-sort">
        {(
          [
            ["newest", "Newest"],
            ["oldest", "Oldest"],
            ["liked", "Most liked"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSort(id)}
            className={cn("rounded-full px-2.5 py-1", sort === id ? "bg-pill text-ink" : "text-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-xs text-secondary">
            Replying to @{replyTo.username}
            <button type="button" onClick={() => setReplyTo(null)} className="text-ink">
              Cancel
            </button>
          </div>
        )}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={signedIn ? "Add a comment" : "Sign in to comment"}
          className="field min-h-24"
          data-testid="comment-body"
        />
        <div className="mt-2 flex items-center justify-between">
          {error ? <p className="text-sm text-no">{error}</p> : <span />}
          <button type="submit" disabled={pending || body.trim().length === 0} className="btn-primary h-9" data-testid="comment-submit">
            {pending ? "Posting" : "Post"}
          </button>
        </div>
      </form>
      <div className="mt-5 space-y-5">
        {roots.length === 0 && <p className="text-sm text-secondary">No comments yet.</p>}
        {roots.map((comment) => (
          <CommentItem key={comment.id} comment={comment} signedIn={signedIn} slug={market.slug} onReply={startReply} />
        ))}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  signedIn,
  slug,
  onReply,
  nested = false,
}: {
  comment: CommentView;
  signedIn: boolean;
  slug: string;
  onReply: (id: string, username: string) => void;
  nested?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [likes, setLikes] = useState(comment.likes);
  const [liked, setLiked] = useState(comment.liked);
  const [gone, setGone] = useState(comment.deleted);

  async function like() {
    if (!signedIn) {
      router.push(`/signin?next=/market/${slug}`);
      return;
    }
    const result = await postJson<{ liked: boolean; likes: number }>(`/api/comments/${comment.id}/like`, {});
    setLiked(result.liked);
    setLikes(result.likes);
  }

  async function save() {
    await postJson(`/api/comments/${comment.id}`, { body: draft }, "PATCH");
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    await postJson(`/api/comments/${comment.id}`, {}, "DELETE");
    setGone(true);
    router.refresh();
  }

  return (
    <article data-testid={`comment-${comment.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Avatar name={comment.user.name} color={comment.user.avatarColor} size={nested ? 20 : 24} />
        <Link href={`/profile/${comment.user.username}`} className="font-medium text-ink hover:underline">
          {comment.user.name}
        </Link>
        {comment.user.isBot && <BotBadge />}
        {comment.badge && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", comment.badge === "NO" ? "bg-noTint text-no" : "bg-yesTint text-yes")}>
            {comment.badge}
          </span>
        )}
        {comment.tradeNote && (
          <span className="text-xs text-secondary" data-testid="trade-note-badge">
            {comment.tradeNote}
          </span>
        )}
        <span className="text-xs text-muted">{formatDateTime(comment.createdAt)}</span>
        {comment.editedAt && !gone && <span className="text-xs text-muted">(edited)</span>}
      </div>
      {gone ? (
        <p className="mt-1.5 text-sm text-muted">This comment was deleted.</p>
      ) : editing ? (
        <div className="mt-2">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="field min-h-20" data-testid="comment-edit" />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{comment.body}</p>
      )}
      {!gone && (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-secondary">
          <button type="button" onClick={() => void like()} data-testid="comment-like" className={cn("hover:text-ink", liked && "text-ink")}>
            {liked ? "Liked" : "Like"} · {likes}
          </button>
          <button type="button" onClick={() => onReply(comment.id, comment.user.username)} className="hover:text-ink">
            Reply
          </button>
          {comment.mine && (
            <>
              <button type="button" data-testid="comment-edit-open" onClick={() => setEditing(true)} className="hover:text-ink">
                Edit
              </button>
              <button type="button" data-testid="comment-delete" onClick={() => void remove()} className="hover:text-ink">
                Delete
              </button>
            </>
          )}
        </div>
      )}
      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-line pl-4">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} signedIn={signedIn} slug={slug} onReply={onReply} nested />
          ))}
        </div>
      )}
    </article>
  );
}
