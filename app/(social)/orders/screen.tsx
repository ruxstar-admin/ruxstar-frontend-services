"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { OrderRow } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { myOrders, STATUS_LABEL } from "@/lib/api/orders";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";

/** Your print orders, newest first. */
export function OrdersScreen() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(myOrders);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your orders</h1>
      {loading ? (
        <SkeletonRows />
      ) : error && items.length === 0 ? (
        <div className={social.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty title="No orders yet">
          <p>Print shops near you are on Discover. Upload your file, pick options and pay.</p>
          <ButtonLink href="/discover" variant="secondary">
            Find a print shop
          </ButtonLink>
        </Empty>
      ) : (
        <ul className={styles.rows}>
          {items.map((o) => (
            <OrderRow key={o.id} href={`/orders/${o.id}`} order={o} subtitle={o.shop.name} amount={o.price.total} labels={STATUS_LABEL} />
          ))}
          {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
          {loadingMore && <SkeletonRows count={1} />}
        </ul>
      )}
    </div>
  );
}
