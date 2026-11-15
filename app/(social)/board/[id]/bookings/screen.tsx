"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back } from "@/components/vendor/parts";
import { useDesk } from "@/components/turf/desk";
import { formError } from "@/lib/api/account";
import { money } from "@/lib/api/shops";
import { deskBookings, type DeskBooking, type DeskBookingsView } from "@/lib/api/turf";
import { BOOKING_STATUS, nextDate, weeksText, whenText } from "@/lib/turf";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

const VIEWS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

function BookingRow({ item }: { item: DeskBooking }) {
  const status = BOOKING_STATUS[item.status];
  const next = nextDate(item);
  return (
    <Link href={`/board/bookings/${item.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="ball" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{item.customer.name}</span>
        <span className={order.small}>{`${item.court.name} · ${whenText(next.startAt, next.endAt)}`}</span>
        <span className={order.faint}>
          {[item.weeks > 1 ? `Weekly, ${weeksText(item.weeks)}` : null, item.sport?.name, `${money(item.price.total)}`, `#${item.orderNo}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {item.status !== "confirmed" && <Tag tone={status.tone}>{status.label}</Tag>}
      {next.arrival === "arrived" && <Tag tone="success">Arrived</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Bookings({ groundId, view }: { groundId: string; view: DeskBookingsView }) {
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => deskBookings(groundId, view, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);
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
    return (
      <Empty title={view === "upcoming" ? "No bookings coming up" : "No bookings yet"}>
        <p>{view === "upcoming" ? "New bookings show up here and on the board as soon as players pay." : "Bookings whose dates have passed, and cancelled ones, show up here."}</p>
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

/** A ground's bookings for its owner and staff: who, which court and when, newest dates first. Same as the app. */
export function DeskBookingsScreen({ id }: { id: string }) {
  const { ground } = useDesk(id);
  const [view, setView] = useState<DeskBookingsView>("upcoming");
  return (
    <div className={order.page}>
      <Back href={`/board/${id}`}>Board</Back>
      <h1 className={order.title}>{ground ? `Bookings · ${ground.name}` : "Bookings"}</h1>
      <Segmented label="Which bookings" options={VIEWS} value={view} onChange={setView} />
      <Bookings key={view} groundId={id} view={view} />
    </div>
  );
}
