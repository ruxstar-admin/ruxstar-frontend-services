"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, Rows, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { Stars } from "@/components/reviews/Reviews";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import type { ReportStatus } from "@/lib/api/admin";
import { keepReview, removeReview, REPORT_REASONS, reviewReports, starsLabel, type ReviewCase } from "@/lib/api/reviews";
import { ago, exact } from "@/lib/time";

const reasonText = (c: ReviewCase) =>
  REPORT_REASONS.filter((r) => c.reasons[r.key] > 0)
    .map((r) => `${r.label} ${c.reasons[r.key]}`)
    .join(", ");

function ReviewDetail({ c, onDone }: { c: ReviewCase; onDone: (message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAct = useCan("reports.act");
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null);
  const keys = useRef({ keep: crypto.randomUUID(), remove: crypto.randomUUID() });
  const review = c.review;

  async function act(kind: "keep" | "remove", reason = "") {
    setBusy(kind);
    try {
      if (kind === "keep") await keepReview(c.reviewId, keys.current.keep);
      else await removeReview(c.reviewId, reason, keys.current.remove);
      onDone(kind === "keep" ? "Review kept up." : "Review removed. The customer was told why.");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Reports" value={String(c.reports)} />
        <Fact label="First reported" value={date(c.firstAt)} />
        <Fact label="Last reported" value={date(c.lastAt)} />
        {review && <Fact label="Shop" value={review.shop.name} />}
        {review && <Fact label="Order" value={`#${review.orderNo} · ${review.product}`} />}
        {review && <Fact label="Written" value={date(review.createdAt)} />}
      </dl>

      {review ? (
        <>
          <Stars value={review.rating} size={16} />
          {review.text ? <p className={styles.text}>{review.text}</p> : <p className={styles.note}>Stars only, no text.</p>}
          {review.reply && <p className={styles.text}>{`Shop's reply: ${review.reply.text}`}</p>}
          {review.status === "removed" && review.removal && (
            <p className={styles.note} data-tone="danger">
              Removed {ago(review.removal.at)}: {review.removal.reason}
            </p>
          )}
        </>
      ) : (
        <p className={styles.note}>The customer deleted this review.</p>
      )}
      {c.notes.map((note, i) => (
        <p key={i} className={styles.text}>
          “{note}”
        </p>
      ))}

      {c.status === "open" &&
        canAct &&
        (removing ? (
          <ReasonForm
            prompt="Why is it coming down? The customer will see this. The shop sees it in its activity."
            placeholder="For example: reviews can't advertise other services."
            confirm="Remove review"
            busy={busy === "remove"}
            onCancel={() => setRemoving(false)}
            onSubmit={(reason) => act("remove", reason)}
          />
        ) : (
          <div className={styles.actions}>
            {review?.status === "live" && (
              <Link href={`/b/${review.shop.id}/reviews`} className={styles.muted} target="_blank">
                Open the shop&apos;s reviews
              </Link>
            )}
            <Button variant="secondary" onClick={() => act("keep")} loading={busy === "keep"} disabled={!!busy}>
              Keep it up
            </Button>
            {review?.status === "live" && (
              <Button variant="danger" onClick={() => setRemoving(true)} disabled={!!busy} icon={<Icon name="trash" size={18} />}>
                Remove
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}

/** Reported shop reviews, one row per review. Same as the app. */
export function ReviewReportsQueue({ status }: { status: ReportStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => reviewReports(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{status === "open" ? "No reported reviews." : "Nothing closed yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((c) => {
        const expanded = open === c.reviewId;
        const review = c.review;
        const when = status === "open" ? c.lastAt : (c.closedAt ?? c.lastAt);
        return (
          <li key={c.reviewId} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.reviewId)}>
              <Avatar name={review?.author?.name ?? "?"} url={review?.author?.avatarUrl} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{review ? `${starsLabel(review.rating)} for ${review.shop.name}` : "Deleted review"}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {review?.text ? `${review.text.slice(0, 60)} · ` : ""}
                  {reasonText(c) || `${c.reports} reports`}
                </span>
              </span>
              {c.outcome ? (
                <Tag tone={c.outcome === "removed" ? "danger" : "success"}>{c.outcome === "removed" ? "Removed" : "Kept"}</Tag>
              ) : (
                <Tag tone="warning">{c.reports === 1 ? "1 report" : `${c.reports} reports`}</Tag>
              )}
              <time className={styles.time} dateTime={when} title={exact(when)}>
                {ago(when)}
              </time>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <ReviewDetail
                c={c}
                onDone={(message) => {
                  toast(message, "success");
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.reviewId !== c.reviewId));
                }}
              />
            )}
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}
