"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { FilterRow, FilterSelect } from "@/components/shop/FilterSelect";
import { ShopCardSkeleton } from "@/components/shop/ShopCard";
import { formError } from "@/lib/api/account";
import { listEvents, type EventFilters, type EventKind } from "@/lib/api/events";
import { KIND_LABEL, KINDS } from "@/lib/events";
import { EventCard } from "./EventCard";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/shop.module.css";

function Cards({ filters }: { filters: EventFilters }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => listEvents(filters, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={styles.grid} aria-busy>
        <ShopCardSkeleton />
        <ShopCardSkeleton />
        <ShopCardSkeleton />
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <div className={social.failed} role="alert">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    const searching = Boolean(filters.q || filters.kind);
    return (
      <Empty title={searching ? "No events match" : "No events coming up"}>
        <p>{searching ? "Try another kind or name." : "Concerts, matches and meetups on Ruxstar show up here as soon as they go on sale."}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={styles.grid}>
        {items.map((event, i) => (
          <li key={event.id}>
            <EventCard event={event} index={i} eager={i < 3} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && (
        <div className={styles.grid} aria-busy>
          <ShopCardSkeleton />
        </div>
      )}
    </>
  );
}

/** What's on, soonest first, for Discover: filter by kind; the search box matches titles, organisers and cities. Same as the app. */
export default function EventResults({ q }: { q: string }) {
  const [kind, setKind] = useState<EventKind | "">("");
  const filters: EventFilters = { ...(q ? { q } : {}), ...(kind ? { kind } : {}) };
  return (
    <>
      <FilterRow label="Event filters">
        <FilterSelect label="Kind of event" value={kind} onChange={setKind} options={[{ value: "", label: "All events" }, ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))]} />
      </FilterRow>
      <Cards key={`${q}|${kind}`} filters={filters} />
    </>
  );
}
