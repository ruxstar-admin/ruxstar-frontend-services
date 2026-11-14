"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { myTickets, type MyTicketsView, type TicketOrder } from "@/lib/api/events";
import { dayText, ORDER_STATUS, timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

const VIEWS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

function OrderRow({ booking }: { booking: TicketOrder }) {
  const status = ORDER_STATUS[booking.status];
  const [, day, month] = dayText(booking.event.startsAt).replace(",", "").split(" ");
  const count = booking.tickets.length;
  return (
    <Link href={`/tickets/${booking.id}`} className={order.row}>
      <span className={styles.dateTag} aria-hidden>
        <span className={styles.dateDay}>{day}</span>
        <span className={styles.dateMonth}>{month?.toUpperCase()}</span>
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{booking.event.title}</span>
        <span className={order.small}>{`${dayText(booking.event.startsAt)}, ${timeText(booking.event.startsAt)} · ${booking.event.online ? "Online" : (booking.event.venueName ?? "")}`}</span>
        <span className={order.faint}>{count === 1 ? "1 ticket" : `${count} tickets`}</span>
      </span>
      {(booking.status !== "confirmed" || booking.event.cancelled) && (
        <Tag tone={booking.event.cancelled ? "danger" : status.tone}>{booking.event.cancelled ? "Event cancelled" : status.label}</Tag>
      )}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function List({ view }: { view: MyTicketsView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => myTickets(view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={order.rows} aria-busy>
        <Skeleton height={84} radius={16} />
        <Skeleton height={84} radius={16} />
        <Skeleton height={84} radius={16} />
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
    return view === "upcoming" ? (
      <Empty title="No tickets yet">
        <p>Tickets you book show up here, with a QR code for each person.</p>
        <ButtonLink href="/discover?category=events" variant="secondary">
          Find events
        </ButtonLink>
      </Empty>
    ) : (
      <Empty title="No past events">
        <p>Events you went to show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={order.rows}>
        {items.map((b) => (
          <li key={b.id}>
            <OrderRow booking={b} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** Every booking, soonest first; past ones on their own tab. Same as the app. */
export function MyTicketsScreen() {
  const [view, setView] = useState<MyTicketsView>("upcoming");
  return (
    <div className={order.page}>
      <div className={shop.headRow}>
        <h1 className={order.title}>Your tickets</h1>
        <ButtonLink href="/discover?category=events" variant="secondary" icon={<Icon name="search" size={16} />}>
          Find events
        </ButtonLink>
      </div>
      <Segmented label="Which tickets" options={VIEWS} value={view} onChange={setView} />
      <List key={view} view={view} />
    </div>
  );
}
