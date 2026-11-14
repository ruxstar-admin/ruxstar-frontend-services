"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { guestList, type Guest, type GuestsView } from "@/lib/api/events";
import { timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

const VIEWS = [
  { value: "not_arrived", label: "Not here yet" },
  { value: "arrived", label: "Arrived" },
  { value: "all", label: "Everyone" },
] as const;

function GuestRow({ guest }: { guest: Guest }) {
  return (
    <li className={styles.tierRow}>
      <span className={styles.tierText}>
        <span className={styles.tierName}>{guest.name}</span>
        <span className={order.small}>{[guest.team, guest.tier, guest.code].filter(Boolean).join(" · ")}</span>
        {guest.inToday && (
          <span className={order.small}>
            {`In at ${timeText(guest.inToday)}${guest.by ? ` by ${guest.by}` : ""}${guest.manual ? ", typed in" : ""}`}
            {guest.clash && <span className={styles.seats} data-low>{" · also used on another phone"}</span>}
          </span>
        )}
      </span>
      {guest.inToday ? <Tag tone="success">In</Tag> : null}
      {guest.phone && (
        <a className={styles.textLink} href={`tel:${guest.phone}`} aria-label={`Call ${guest.name}`}>
          Call
        </a>
      )}
    </li>
  );
}

function List({ eventId, view }: { eventId: string; view: GuestsView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => guestList(eventId, view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={order.rows} aria-busy>
        <Skeleton height={60} radius={14} />
        <Skeleton height={60} radius={14} />
        <Skeleton height={60} radius={14} />
      </div>
    );
  }
  if (error && items.length === 0) {
    return (
      <Empty title="Can’t show the guest list">
        <p>{formError(error).message}</p>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </Empty>
    );
  }
  if (items.length === 0) {
    return <Empty title={view === "not_arrived" ? "Everyone’s here" : view === "arrived" ? "No one in yet today" : "No tickets yet"} />;
  }
  return (
    <>
      <ul className={styles.tiers}>
        {items.map((g) => (
          <GuestRow key={g.id} guest={g} />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={60} radius={14} />}
    </>
  );
}

/** Who has a ticket and who has come in today, for the owner and team allowed to see it. Same as the app. */
export function GuestListScreen({ id }: { id: string }) {
  const [view, setView] = useState<GuestsView>("not_arrived");
  return (
    <div className={order.page}>
      <div>
        <ButtonLink href={`/gate/${id}`} variant="ghost" icon={<Icon name="arrow-left" size={16} />}>
          Back to the gate
        </ButtonLink>
      </div>
      <h1 className={order.title}>Guest list</h1>
      <Segmented label="Which guests" options={VIEWS} value={view} onChange={setView} />
      <List key={view} eventId={id} view={view} />
    </div>
  );
}
