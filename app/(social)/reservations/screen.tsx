"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { formError } from "@/lib/api/account";
import { myStays, type MyStaysView, type StayReservation } from "@/lib/api/stays";
import { bedsText, STAY_STATUS, stayText } from "@/lib/stays";
import social from "@/components/social/social.module.css";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";

const VIEWS = [
  { value: "current", label: "Current" },
  { value: "past", label: "Past" },
] as const;

function StayRow({ item }: { item: StayReservation }) {
  const status = STAY_STATUS[item.status];
  return (
    <Link href={`/reservations/${item.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="bed" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{item.property.name}</span>
        <span className={order.small}>{`${bedsText(item)} · ${stayText(item, false)}`}</span>
        <span className={order.faint}>{[item.objection?.status === "open" ? "Objection open" : null, `#${item.orderNo}`].filter(Boolean).join(" · ")}</span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Stays({ view }: { view: MyStaysView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => myStays(view, cursor));
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
      <Empty title="No stays yet">
        <p>Reserve a bed or a room in a PG or hostel. You pay the first month (or the nights) here, and the deposit to the owner.</p>
        <ButtonLink href="/discover?category=stays" variant="secondary">
          Find a PG or hostel
        </ButtonLink>
      </Empty>
    ) : (
      <Empty title="Nothing here yet">
        <p>Stays you’ve moved out of, and cancelled reservations, show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={order.rows}>
        {items.map((item) => (
          <li key={item.id}>
            <StayRow item={item} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** Your PG and hostel reservations: current ones (unpaid, reserved, living there), then past and cancelled. */
export function MyStaysScreen() {
  const [view, setView] = useState<MyStaysView>("current");
  return (
    <div className={order.page}>
      <div className={shop.headRow}>
        <h1 className={order.title}>Your stays</h1>
        <div className={shop.headActions}>
          <ButtonLink href="/discover?category=stays" variant="secondary" icon={<Icon name="search" size={16} />}>
            Find PGs and hostels
          </ButtonLink>
        </div>
      </div>
      <Segmented label="Which stays" options={VIEWS} value={view} onChange={setView} />
      <Stays key={view} view={view} />
    </div>
  );
}
