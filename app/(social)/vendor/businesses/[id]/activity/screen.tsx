"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Skeleton } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { businessActivity, type ActivityEntry } from "@/lib/api/team";
import { ago } from "@/lib/time";
import team from "@/components/team/team.module.css";
import styles from "@/components/vendor/vendor.module.css";

function Who({ who }: { who: ActivityEntry["who"] }) {
  if (who.kind === "you" || who.kind === "team") return <Avatar name={who.name} url={who.avatar} size={40} />;
  return (
    <span className={team.whoIcon}>
      <Icon name={who.kind === "ruxstar" ? "shield" : "user"} size={20} />
    </span>
  );
}

function Row({ entry }: { entry: ActivityEntry }) {
  const body = (
    <>
      <Who who={entry.who} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{entry.line}</span>
        <span className={styles.rowLine}>{`${entry.who.name} · ${ago(entry.at)}`}</span>
      </span>
      {entry.orderId && <Icon name="chevron-right" size={18} />}
    </>
  );
  return (
    <li>
      {entry.orderId ? (
        <Link href={`/vendor/orders/${entry.orderId}`} className={styles.row}>
          {body}
        </Link>
      ) : (
        <div className={styles.row}>{body}</div>
      )}
    </li>
  );
}

/** What happened at a business and who did it, newest first. With `by`, one person's (from their team page). Same as the app. */
export function ActivityScreen({ id, by, name }: { id: string; by?: string; name?: string }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => businessActivity(id, by, cursor), [id, by]);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Loading rows={4} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;

  return (
    <div className={styles.page}>
      {by ? <Back href={`/vendor/businesses/${id}/team`}>Team</Back> : <Back href={`/vendor/businesses/${id}`}>Business</Back>}
      <h1 className={styles.title}>{name ? `${name}’s activity` : "Activity"}</h1>
      {!by && <p className={styles.muted}>Orders, shop and coupon changes, posts and the team, by you, your team, customers and Ruxstar.</p>}
      {items.length === 0 ? (
        <div className={styles.card}>
          <h2 className={styles.cardHead}>Nothing yet</h2>
          <p className={styles.muted}>{by ? "What they do at this business shows here." : "What happens at this business shows here."}</p>
        </div>
      ) : (
        <ul className={styles.rows}>
          {items.map((entry) => (
            <Row key={entry.id} entry={entry} />
          ))}
          {hasMore && <li ref={sentinel} aria-hidden />}
          {loadingMore && <Skeleton height={56} radius={14} />}
        </ul>
      )}
    </div>
  );
}
