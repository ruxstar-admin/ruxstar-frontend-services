"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { consoleGrounds, type ConsoleGround, type GroundStatus } from "@/lib/api/turf";
import { GROUND_STATUS, priceFromText } from "@/lib/turf";

type Status = GroundStatus | "all";
type Filter = { status?: GroundStatus; q?: string };

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Drafts" },
  { value: "removed", label: "Taken down" },
];

function Results({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleGrounds(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleGround>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q ? "No ground matches that. Try another word from the ground’s or the business’s name." : "Grounds sports businesses add show up here."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((g) => {
        const status = GROUND_STATUS[g.status];
        return (
          <li key={g.id} className={styles.item}>
            <Link href={`/admin/grounds/${g.id}`} className={styles.row}>
              <Avatar name={g.name} url={g.photo?.url ?? null} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{g.name}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {`${g.business.name} · ${g.city} · ${g.courts} ${g.courts === 1 ? "court" : "courts"} · ${priceFromText(g.priceFrom)}`}
                </span>
              </span>
              <span className={styles.tags}>
                <Tag tone={status.tone}>{status.label}</Tag>
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

/** Every sports business's grounds, newest first, searchable by name and filtered by status. Same as the app. */
export function GroundsScreen() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filter: Filter = { ...(q ? { q } : {}), ...(status === "all" ? {} : { status }) };

  return (
    <Needs need="businesses.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Grounds</h1>
        <div className={styles.toolbar}>
          <Input
            label="Find a ground"
            placeholder="Ground or business name"
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={60}
            autoComplete="off"
          />
          <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} />
        </div>
        <Results key={`${status}:${q}`} filter={filter} />
      </div>
    </Needs>
  );
}
