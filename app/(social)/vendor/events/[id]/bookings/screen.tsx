"use client";

import { useEffect, useState } from "react";
import { Button, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back } from "@/components/vendor/parts";
import { formError } from "@/lib/api/account";
import { eventBookings, type Booking, type BookingStatus } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import { dayText, ORDER_STATUS, timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "@/components/events/events.module.css";

const VIEWS = [
  { value: "confirmed", label: "Booked" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function BookingCard({ booking }: { booking: Booking }) {
  const [open, setOpen] = useState(false);
  const status = ORDER_STATUS[booking.status];
  const first = booking.tickets[0];
  const count = booking.tickets.length;
  const panel = `booking-${booking.id}`;
  return (
    <div className={`${vendor.card} ${styles.booking}`}>
      <button type="button" className={styles.bookingHead} aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
        <span className={vendor.rowText}>
          <span className={vendor.rowTitle}>{booking.team ?? first?.name ?? `Booking #${booking.orderNo}`}</span>
          <span className={vendor.rowLine}>{`#${booking.orderNo} · ${count} ${count === 1 ? "ticket" : "tickets"} · ${dayText(booking.createdAt)}`}</span>
        </span>
        <span className={vendor.rowTitle}>{booking.total ? money(booking.share) : "Free"}</span>
        {booking.status !== "confirmed" && <Tag tone={status.tone}>{status.label}</Tag>}
        <Icon name="chevron-down" size={18} />
      </button>
      {booking.refunded > 0 && <span className={vendor.muted}>{`${money(booking.refunded)} refunded`}</span>}
      {open && (
        <div id={panel} className={styles.booking}>
          {booking.tickets.map((t) => (
            <div key={t.id} className={styles.holder}>
              <div className={styles.holderHead}>
                <strong>{t.name}</strong>
                {t.lastIn && <Tag tone="success">{`In ${dayText(t.lastIn)}, ${timeText(t.lastIn)}`}</Tag>}
              </div>
              <span className={vendor.muted}>{[t.tier, t.code, t.phone].filter(Boolean).join(" · ")}</span>
              {t.answers.map((a) => (
                <span key={a.label} className={vendor.muted}>{`${a.label}: ${a.answer}`}</span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function List({ eventId, view }: { eventId: string; view: BookingStatus }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => eventBookings(eventId, view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={vendor.page} aria-busy>
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
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
    return (
      <Empty title={view === "confirmed" ? "No bookings yet" : "No cancelled bookings"}>
        {view === "confirmed" && <p>Bookings show up here as people buy tickets.</p>}
      </Empty>
    );
  }
  return (
    <>
      {items.map((b) => (
        <BookingCard key={b.id} booking={b} />
      ))}
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={16} />}
    </>
  );
}

/** Who booked an event, newest first: open one for each person's ticket, answers and check-in. Same as the app. */
export function EventBookingsScreen({ id }: { id: string }) {
  const [view, setView] = useState<BookingStatus>("confirmed");
  return (
    <div className={vendor.page}>
      <Back href={`/vendor/events/${id}`}>Event</Back>
      <h1 className={vendor.title}>Bookings</h1>
      <Segmented label="Which bookings" options={VIEWS} value={view} onChange={setView} />
      <List key={view} eventId={id} view={view} />
    </div>
  );
}
