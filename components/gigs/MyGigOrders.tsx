"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { formError } from "@/lib/api/account";
import { myGigOrders } from "@/lib/api/gigs";
import { GigOrderRow } from "./GigOrderRow";
import shop from "@/components/shop/shop.module.css";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";

type Period = "current" | "past";
const VIEWS: { value: Period; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "past", label: "Past" },
];

function Orders({ view }: { view: Period }) {
  const onSignedOut = useOnSignedOut();
  const [now] = useState(Date.now);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => myGigOrders(view, cursor));
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
    return view === "current" ? (
      <Empty title="No freelance orders going on">
        <p>Gigs you order and offers you pay for show up here until they’re done.</p>
        <ButtonLink href="/discover?category=gigs" variant="secondary">
          Find a freelancer
        </ButtonLink>
      </Empty>
    ) : (
      <Empty title="Nothing here yet">
        <p>Completed and cancelled freelance orders show up here.</p>
      </Empty>
    );
  }
  return (
    <ul className={styles.rows}>
      {items.map((o) => (
        <GigOrderRow key={o.id} href={`/orders/freelance/${o.id}`} order={o} subtitle={o.freelancer.name} amount={o.price.total} now={now} />
      ))}
      {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <SkeletonRows count={1} />}
    </ul>
  );
}

/** Your freelance orders: the ones going on, or the ones done with. Same as the app. */
export function MyGigOrders() {
  const [view, setView] = useState<Period>("current");
  return (
    <>
      <div className={shop.chips} role="group" aria-label="Which freelance orders">
        {VIEWS.map((v) => (
          <button key={v.value} type="button" className={shop.subChip} aria-pressed={view === v.value} onClick={() => setView(v.value)}>
            {v.label}
          </button>
        ))}
      </div>
      <Orders key={view} view={view} />
    </>
  );
}
