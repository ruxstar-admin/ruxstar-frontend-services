"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Skeleton } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back, Failed } from "@/components/vendor/parts";
import {
  businessReviews,
  moduleOf,
  ORDER_WORD,
  removeOwnerReply,
  removeTeamReply,
  replyAsOwner,
  replyAsTeam,
  workReviews,
  type ReviewModule,
  type ShopReview,
} from "@/lib/api/reviews";
import { formError } from "@/lib/api/account";
import { ReviewCard, TextAction } from "./Reviews";
import order from "@/components/shop/order.module.css";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./reviews.module.css";

const REPLY_TEXT_MAX = 500;

/** When customers can review, per kind of business. */
const WHEN: Record<ReviewModule, string> = {
  pod: "Customers review delivered orders for 30 days.",
  events: "People review their booking once they’re checked in or the event ends, for 30 days after it.",
  coaching: "Students review their enrolment once the first class is held, until 30 days after the last class.",
  turf: "Players review their booking once they’ve played, until 30 days after its last date.",
};

/** Where the owner (or the team, for print) opens what was reviewed. */
function reviewedLink(review: ShopReview, team: boolean): { href: string; label: string } | null {
  const module = moduleOf(review);
  if (module === "pod") return { href: team ? `/work/order/${review.orderId}` : `/vendor/orders/${review.orderId}`, label: "Open order" };
  if (team || !review.listing) return null;
  if (review.listing.type === "ground") return { href: `/board/bookings/${review.orderId}`, label: "Open booking" };
  return review.listing.type === "event"
    ? { href: `/vendor/events/${review.listing.id}/bookings`, label: "See bookings" }
    : { href: `/vendor/courses/${review.listing.id}/students`, label: "See students" };
}

function ReplyForm({ review, send, onClose }: { review: ShopReview; send: (text: string | null) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(review.reply?.text ?? "");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "save" | "remove") => {
    setBusy(kind);
    setError(null);
    try {
      await send(kind === "save" ? text.trim() : null);
      onClose();
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={order.news}>
      <strong>{review.reply ? "Change the reply" : "Reply to this review"}</strong>
      <p className={order.small}>Everyone sees the reply under the review. The customer is told the first time.</p>
      <textarea
        className={order.textarea}
        aria-label="Reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={REPLY_TEXT_MAX}
        placeholder="Thank them, or say what you'll do about it"
      />
      <p className={order.faint}>{`${text.length}/${REPLY_TEXT_MAX}`}</p>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={busy === "save"} disabled={text.trim().length < 2 || busy !== null} onClick={() => void run("save")}>
          {review.reply ? "Save reply" : "Post reply"}
        </Button>
        {review.reply && (
          <Button variant="ghost" loading={busy === "remove"} disabled={busy !== null} onClick={() => void run("remove")}>
            Take the reply down
          </Button>
        )}
        <Button variant="ghost" disabled={busy !== null} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * A shop's reviews with its replies: the owner's from the vendor portal (`id` is the business), or the team's from Work
 * (`id` is the place, and it needs "Reply to reviews"). Same as the app.
 */
export function ReplyReviews({ id, team = false }: { id: string; team?: boolean }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => (team ? workReviews(id, cursor) : businessReviews(id, cursor)), [id, team]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);
  const [replying, setReplying] = useState<string | null>(null);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  const send = (review: ShopReview) => async (text: string | null) => {
    const next =
      text === null
        ? await (team ? removeTeamReply(id, review.id) : removeOwnerReply(id, review.id))
        : await (team ? replyAsTeam(id, review.id, text) : replyAsOwner(id, review.id, text));
    if (next) setItems((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  };

  const module = items[0] ? moduleOf(items[0]) : null;

  return (
    <div className={vendor.page}>
      {team ? <Back href={`/work/${id}`}>Work</Back> : <Back href={`/vendor/businesses/${id}`}>Business</Back>}
      <h1 className={vendor.title}>Reviews</h1>
      <p className={vendor.muted}>{`${module ? `${WHEN[module]} ` : ""}Only Ruxstar can remove a review.`}</p>
      {loading ? (
        <div className={styles.list} aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={110} radius={18} />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <Failed error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <div className={vendor.card}>
          <h2 className={vendor.cardHead}>No reviews yet</h2>
          <p className={vendor.muted}>Customers are asked for a review after a delivery, after an event, or once their first class is held.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((review) => {
            if (replying === review.id) return <ReplyForm key={review.id} review={review} send={send(review)} onClose={() => setReplying(null)} />;
            const kind = moduleOf(review);
            const link = reviewedLink(review, team);
            return (
              <ReviewCard key={review.id} review={review} extra={kind === "pod" ? `#${review.orderNo}` : `${ORDER_WORD[kind]} #${review.orderNo}`}>
                <div className={styles.actions}>
                  <TextAction onClick={() => setReplying(review.id)}>{review.reply ? "Edit reply" : "Reply"}</TextAction>
                  {link && (
                    <Link href={link.href} className={styles.link} data-muted>
                      {link.label}
                    </Link>
                  )}
                </div>
              </ReviewCard>
            );
          })}
          {hasMore && <div ref={sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={110} radius={18} />}
        </div>
      )}
    </div>
  );
}
