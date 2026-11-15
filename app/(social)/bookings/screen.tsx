"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { myBookings, type MyBookingsView, type TurfBooking } from "@/lib/api/turf";
import { BOOKING_STATUS, nextDate, weeksText, whenText } from "@/lib/turf";
import social from "@/components/social/social.module.css";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";

const VIEWS = [
  { value: "current", label: "Upcoming" },
  { value: "past", label: "Past" },
] as const;

function BookingRow({ item }: { item: TurfBooking }) {
  const status = BOOKING_STATUS[item.status];
  const next = nextDate(item);
  return (
    <Link href={`/bookings/${item.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="ball" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{item.ground.name}</span>
        <span className={order.small}>{`${item.court.name} · ${whenText(next.startAt, next.endAt)}`}</span>
        <span className={order.faint}>{[item.weeks > 1 ? `Weekly, ${weeksText(item.weeks)}` : null, item.sport?.name, `#${item.orderNo}`].filter(Boolean).join(" · ")}</span>
      </span>
      {item.status !== "confirmed" && <Tag tone={status.tone}>{status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Bookings({ view }: { view: MyBookingsView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => myBookings(view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) {
    return (
      <div className={order.rows} aria-busy>
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
    return view === "current" ? (
      <Empty title="No bookings coming up">
        <p>Book a turf, court or net by the slot, for once or every week.</p>
        <ButtonLink href="/discover?category=turf" variant="secondary">
          Find a ground
        </ButtonLink>
      </Empty>
    ) : (
      <Empty title="Nothing played yet">
        <p>Bookings whose dates have passed, and cancelled ones, show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={order.rows}>
        {items.map((item) => (
          <li key={item.id}>
            <BookingRow item={item} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** Your turf bookings: upcoming ones (and unpaid ones), then past and cancelled. Same as the app. */
export function MyBookingsScreen() {
  const [view, setView] = useState<MyBookingsView>("current");
  return (
    <div className={order.page}>
      <div className={shop.headRow}>
        <h1 className={order.title}>Your bookings</h1>
        <div className={shop.headActions}>
          <ButtonLink href="/discover?category=turf" variant="secondary" icon={<Icon name="search" size={16} />}>
            Find grounds
          </ButtonLink>
        </div>
      </div>
      <Segmented label="Which bookings" options={VIEWS} value={view} onChange={setView} />
      <Bookings key={view} view={view} />
    </div>
  );
}
