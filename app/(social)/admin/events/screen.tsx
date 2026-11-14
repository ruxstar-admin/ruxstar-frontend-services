"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Icon, Input, Segmented, Skeleton, Tag } from "@/components/ui";
import { staffEvents, type StaffEventStatus, type VendorEvent } from "@/lib/api/events";
import { dayText, EVENT_STATUS, soldLine } from "@/lib/events";

type Status = StaffEventStatus | "all";
type Filter = { status?: StaffEventStatus; q?: string };

/** Published covers events on sale and ones that have ended; the API keeps both as live. */
const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "cancelled", label: "Cancelled" },
];

function Results({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => staffEvents(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<VendorEvent>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{filter.q ? "No event matches that. Try another word from the event name or the organiser’s name." : "Events organisers make show up here."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((e) => {
        const status = EVENT_STATUS[e.status];
        return (
          <li key={e.id} className={styles.item}>
            <Link href={`/admin/events/${e.id}`} className={styles.row}>
              <Avatar name={e.title} url={e.photo?.url ?? null} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{e.title}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {`${e.business.name} · ${dayText(e.startsAt)} · ${e.status === "draft" ? "Not published" : soldLine(e)}`}
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

/** Every organiser's events, newest first, searchable by name and filtered by status. Same as the app. */
export function EventsScreen() {
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
        <h1 className={styles.title}>Events</h1>
        <div className={styles.toolbar}>
          <Input
            label="Find an event"
            placeholder="Event or organiser name"
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
