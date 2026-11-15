"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Icon, Segmented, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back } from "@/components/vendor/parts";
import { useStaysDesk } from "@/components/stays/desk";
import { formError } from "@/lib/api/account";
import { money } from "@/lib/api/shops";
import { deskReservations, type DeskReservation, type DeskReservationsView } from "@/lib/api/stays";
import { bedsText, STAY_STATUS, stayText } from "@/lib/stays";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

const VIEWS = [
  { value: "upcoming", label: "Moving in" },
  { value: "staying", label: "Staying" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

const EMPTY: Record<DeskReservationsView, { title: string; line: string }> = {
  upcoming: { title: "No one moving in yet", line: "Paid reservations waiting for move-in show up here and on the bed map as soon as tenants pay." },
  staying: { title: "No one staying now", line: "Tenants you’ve marked moved in show up here until they move out." },
  past: { title: "No past reservations", line: "Moved-out and cancelled reservations show up here." },
  all: { title: "No reservations yet", line: "Every reservation at this property shows up here." },
};

function ReservationRow({ item }: { item: DeskReservation }) {
  const status = STAY_STATUS[item.status];
  return (
    <Link href={`/beds/reservations/${item.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="bed" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{item.tenant.name}</span>
        <span className={order.small}>{`${bedsText(item)} · ${stayText(item, false)}`}</span>
        <span className={order.faint}>{[money(item.price.total), `#${item.orderNo}`, item.tenant.verified ? "KYC verified" : null].filter(Boolean).join(" · ")}</span>
      </span>
      {item.objection?.status === "open" ? <Tag tone="danger">Problem raised</Tag> : <Tag tone={status.tone}>{status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

function Reservations({ propertyId, view }: { propertyId: string; view: DeskReservationsView }) {
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => deskReservations(propertyId, view, cursor));
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
      <Empty title={EMPTY[view].title}>
        <p>{EMPTY[view].line}</p>
      </Empty>
    );
  }
  return (
    <>
      <ul className={order.rows}>
        {items.map((item) => (
          <li key={item.id}>
            <ReservationRow item={item} />
          </li>
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** A property's reservations for its owner and wardens: who, which bed and from when. */
export function DeskReservationsScreen({ id }: { id: string }) {
  const { property } = useStaysDesk(id);
  const [view, setView] = useState<DeskReservationsView>("upcoming");
  return (
    <div className={order.page}>
      <Back href={`/beds/${id}`}>Bed map</Back>
      <h1 className={order.title}>{property ? `Reservations · ${property.name}` : "Reservations"}</h1>
      <Segmented label="Which reservations" options={VIEWS} value={view} onChange={setView} />
      <Reservations key={view} propertyId={id} view={view} />
    </div>
  );
}
