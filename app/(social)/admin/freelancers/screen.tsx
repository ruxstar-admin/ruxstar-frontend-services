"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Skeleton, Tag, type TagTone } from "@/components/ui";
import { consoleFreelancers, type ConsoleFreelancer } from "@/lib/api/gigs";
import { plural } from "@/lib/gigs";

/** Held by Ruxstar, not verified yet, live or still setting up. */
export const freelancerBadge = (f: Pick<ConsoleFreelancer, "suspended" | "verified" | "status">): { label: string; tone: TagTone } =>
  f.suspended
    ? { label: "On hold", tone: "danger" }
    : !f.verified
      ? { label: "Not verified", tone: "warning" }
      : f.status === "live"
        ? { label: "Live", tone: "success" }
        : { label: "Setting up", tone: "neutral" };

const summary = (f: ConsoleFreelancer) => [f.categoryLabel, f.city, plural(f.gigs, "gig"), plural(f.orders, "order")].filter(Boolean).join(" · ");

function Results({ q }: { q: string }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleFreelancers(q, cursor), [q]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleFreelancer>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{q ? "No freelancer matches that. Try another name." : "People who start freelancing show up here."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((f) => {
        const badge = freelancerBadge(f);
        return (
          <li key={f.businessId} className={styles.item}>
            <Link href={`/admin/freelancers/${f.businessId}`} className={styles.row}>
              <Avatar name={f.name} url={f.avatarUrl} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{f.name}</span>
                <span className={`${styles.muted} ${styles.line}`}>{summary(f)}</span>
              </span>
              <span className={styles.tags}>
                <Tag tone={badge.tone}>{badge.label}</Tag>
              </span>
              <Icon name="chevron-right" size={20} className={styles.chevron} />
            </Link>
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** Every freelancer, newest first, by name; each opens with their gigs and orders. */
export function FreelancersScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Freelancers</h1>
        <div className={styles.toolbar}>
          <Input label="Find a freelancer" placeholder="Freelancer name" type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
        </div>
        <Results key={q} q={q} />
      </div>
    </Needs>
  );
}
