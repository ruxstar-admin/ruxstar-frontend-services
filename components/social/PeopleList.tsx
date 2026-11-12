"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { VerifiedTick } from "@/components/kyc/VerifiedTick";
import { Avatar } from "@/components/profile/Avatar";
import { Button, Skeleton, Tag } from "@/components/ui";
import type { Person } from "@/lib/api/social";
import { Empty } from "./PostList";
import { useNearEnd, type usePages } from "./use-pages";
import styles from "./social.module.css";

/** A paged list of people, each with an action on the right (Follow, Unblock). */
export function PeopleList({
  pages,
  empty,
  action,
}: {
  pages: ReturnType<typeof usePages<Person>>;
  empty: { title: string; text?: string };
  action: (person: Person) => ReactNode;
}) {
  const { items, loading, loadingMore, hasMore, error, more, reload } = pages;
  const sentinel = useNearEnd(more, hasMore && !error);

  if (loading) {
    return (
      <div className={styles.rows}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={68} radius={14} />
        ))}
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <Empty title="Could not load this list">
        <p>Check your connection and try again.</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </Empty>
    );
  }
  if (items.length === 0) {
    return <Empty title={empty.title}>{empty.text && <p>{empty.text}</p>}</Empty>;
  }
  return (
    <ul className={styles.rows}>
      {items.map((p) => (
        <li key={p.id} className={styles.personRow}>
          <Link href={`/u/${p.username}`} className={styles.row}>
            <Avatar name={p.name} url={p.avatarUrl} size={44} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>
                {p.name} {p.verified && <VerifiedTick size={14} />}
              </span>
              <span className={styles.rowSub}>@{p.username}</span>
            </span>
            {p.vendor && <Tag>Vendor</Tag>}
          </Link>
          {action(p)}
        </li>
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={68} radius={14} />}
    </ul>
  );
}
