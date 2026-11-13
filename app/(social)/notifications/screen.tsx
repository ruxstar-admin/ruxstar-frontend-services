"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button, Icon, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { markRead, notifications, type Notification } from "@/lib/api/social";
import { ago, exact } from "@/lib/time";
import styles from "@/components/social/social.module.css";

const ICONS: Record<Notification["type"], IconName> = {
  "post.like": "heart",
  "post.comment": "comment",
  "post.removed": "flag",
  "kyc.approved": "verified",
  "kyc.rejected": "alert",
  "business.suspended": "alert",
  "business.restored": "store",
  "order.placed": "print",
  "order.updated": "print",
  "user.followed": "user",
  "payout.updated": "wallet",
};

function hrefOf(link: Notification["link"]) {
  switch (link.screen) {
    case "verification":
      return "/verify";
    case "business":
      return `/vendor/businesses/${link.id}`;
    case "order":
      return `/orders/${link.id}`;
    case "shop_order":
      return `/vendor/orders/${link.id}`;
    case "profile":
      return `/u/${link.id}`;
    case "payments":
      return "/vendor/payments";
    default:
      return `/p/${link.id}`;
  }
}

/** Likes and comments on your posts, posts the Ruxstar team removed, verification decisions and holds on your businesses. Opening the page marks them read; the dots stay for this visit. */
export function NotificationsScreen() {
  const onSignedOut = useOnSignedOut();
  const pages = usePages(notifications);
  const { items, loading, loadingMore, hasMore, error, more, reload } = pages;
  const sentinel = useNearEnd(more, hasMore && !error);
  const marked = useRef(false);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  useEffect(() => {
    if (loading || error || marked.current || !items.some((n) => !n.read)) return;
    marked.current = true;
    markRead().catch(() => undefined);
  }, [loading, error, items]);

  return (
    <div className={styles.column}>
      <div className={styles.headRow}>
        <h1 className={styles.title}>Notifications</h1>
      </div>
      {loading ? (
        <SkeletonRows />
      ) : error && items.length === 0 ? (
        <div className={styles.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty title="You are all caught up">
          <p>Likes and comments on your posts show up here.</p>
        </Empty>
      ) : (
        <ul className={styles.rows}>
          {items.map((n) => (
            <li key={n.id}>
              <Link href={hrefOf(n.link)} className={styles.row}>
                <span className={styles.rowIcon}>
                  <Icon name={ICONS[n.type] ?? "bell"} filled={n.type === "post.like"} size={20} />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{n.title}</span>
                  <span className={styles.rowBody}>{n.body}</span>
                </span>
                <time className={styles.rowTime} dateTime={n.createdAt} title={exact(n.createdAt)}>
                  {ago(n.createdAt)}
                </time>
                {!n.read && <span className={styles.dot} aria-label="Unread" />}
              </Link>
            </li>
          ))}
          {hasMore && <li ref={sentinel} className={styles.sentinel} aria-hidden />}
          {loadingMore && <SkeletonRows count={1} />}
        </ul>
      )}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skelRow}>
          <span className={styles.skelCircle} />
          <span className={styles.skelLines}>
            <span className={styles.skelLine} style={{ width: "40%" }} />
            <span className={styles.skelLine} style={{ width: "70%" }} />
          </span>
        </div>
      ))}
    </div>
  );
}
