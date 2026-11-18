"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { consoleGigs, type ConsoleGig, type ConsoleGigsQuery, type GigStatus } from "@/lib/api/gigs";
import { cardPriceLine, GIG_STATUS, plural } from "@/lib/gigs";

type Status = GigStatus | "all";

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "paused", label: "Paused" },
  { value: "removed", label: "Taken down" },
];

const summary = (g: ConsoleGig) => [g.freelancer.name, g.categoryLabel, cardPriceLine(g), g.orders ? plural(g.orders, "order") : null].filter(Boolean).join(" · ");

function Results({ query }: { query: ConsoleGigsQuery }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleGigs(query, cursor), [query]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleGig>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>No gigs here. Try another filter or word.</p>;

  return (
    <ul className={styles.list}>
      {items.map((g) => (
        <li key={g.id} className={styles.item}>
          <Link href={`/admin/gigs/${g.id}`} className={styles.row}>
            <Avatar name={g.title} url={g.photo?.url} size={44} />
            <span className={styles.whoRow}>
              <span className={styles.name}>{g.title}</span>
              <span className={`${styles.muted} ${styles.line}`}>{summary(g)}</span>
            </span>
            <span className={styles.tags}>
              <Tag tone={GIG_STATUS[g.status].tone}>{GIG_STATUS[g.status].label}</Tag>
            </span>
            <Icon name="chevron-right" size={20} className={styles.chevron} />
          </Link>
        </li>
      ))}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}

/** Every gig, drafts included, or one freelancer's, by status and words; each opens to be taken down. */
export function GigListingsScreen({ freelancer, label }: { freelancer?: string; label?: string }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const query = useMemo<ConsoleGigsQuery>(() => ({ ...(freelancer ? { freelancer } : {}), ...(q ? { q } : {}), ...(status === "all" ? {} : { status }) }), [freelancer, q, status]);

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>{label ? `${label}: gigs` : "Gigs"}</h1>
        {freelancer && (
          <div className={styles.actions}>
            <ButtonLink href={`/admin/freelancers/${freelancer}`} variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
              Back to the freelancer
            </ButtonLink>
            <ButtonLink href="/admin/gigs" variant="ghost">
              Every gig
            </ButtonLink>
          </div>
        )}
        <div className={styles.toolbar}>
          <Input label="Find a gig" placeholder="Gig title" type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
        </div>
        <Segmented label="Show" options={STATUSES} value={status} onChange={setStatus} />
        <Results key={JSON.stringify(query)} query={query} />
      </div>
    </Needs>
  );
}
