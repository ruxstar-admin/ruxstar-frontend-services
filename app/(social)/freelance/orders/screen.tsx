"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { Back } from "@/components/vendor/parts";
import { GigOrderRow } from "@/components/gigs/GigOrderRow";
import { formError } from "@/lib/api/account";
import { deskGigOrders, type GigOrderStatus } from "@/lib/api/gigs";
import shop from "@/components/shop/shop.module.css";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";
import vendor from "@/components/vendor/vendor.module.css";

type Filter = "all" | Exclude<GigOrderStatus, "awaiting_payment">;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "disputed", label: "Problems" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function Orders({ filter }: { filter: Filter }) {
  const onSignedOut = useOnSignedOut();
  const [now] = useState(Date.now);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => deskGigOrders(filter === "all" ? undefined : filter, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <SkeletonRows />;
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
      <Empty title={filter === "all" ? "No orders yet" : "Nothing here"}>
        <p>{filter === "all" ? "Orders for your gigs and offers you send in chat show up here." : "No orders like this right now."}</p>
      </Empty>
    );
  }
  return (
    <ul className={order.rows}>
      {items.map((o) => (
        <GigOrderRow key={o.id} href={`/freelance/orders/${o.id}`} order={o} subtitle={o.customer.name} amount={o.share} now={now} />
      ))}
      {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <SkeletonRows count={1} />}
    </ul>
  );
}

/** The freelancer's orders: new ones to accept, ones being worked on, delivered, with problems, and done with. */
export function DeskGigOrdersScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  return (
    <div className={vendor.page}>
      <Back href="/freelance">Freelancing</Back>
      <h1 className={vendor.title}>Freelance orders</h1>
      <div className={shop.chips} role="group" aria-label="Which orders">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className={shop.subChip} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      <Orders key={filter} filter={filter} />
    </div>
  );
}
