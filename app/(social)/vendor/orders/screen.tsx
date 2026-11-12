"use client";

import { useEffect, useState } from "react";
import { Button, Segmented } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { OrderRow } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { SHOP_STATUS_LABEL, shopOrders, type ShopOrderView } from "@/lib/api/orders";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";
import vendor from "@/components/vendor/vendor.module.css";

const VIEWS = [
  { value: "new", label: "New" },
  { value: "active", label: "In progress" },
  { value: "past", label: "Past" },
] as const;

const EMPTY: Record<ShopOrderView, { title: string; message: string }> = {
  new: { title: "No new orders", message: "Paid orders to your shops wait here for you to accept." },
  active: { title: "Nothing in progress", message: "Orders you accepted stay here until they are delivered." },
  past: { title: "No past orders", message: "Delivered, turned down and cancelled orders show here." },
};

function SalesList({ view }: { view: ShopOrderView }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => shopOrders(view, cursor));
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
      <Empty title={EMPTY[view].title}>
        <p>{EMPTY[view].message}</p>
      </Empty>
    );
  }
  return (
    <ul className={styles.rows}>
      {items.map((o) => (
        <OrderRow key={o.id} href={`/vendor/orders/${o.id}`} order={o} subtitle={o.shop.name} amount={o.price.payout} labels={SHOP_STATUS_LABEL} />
      ))}
      {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <SkeletonRows count={1} />}
    </ul>
  );
}

/** Paid orders to every shop you run: new ones to accept, ones being made, and past ones. Same as the app's vendor Orders tab. */
export function SalesScreen() {
  const [view, setView] = useState<ShopOrderView>("new");
  return (
    <div className={vendor.page}>
      <h1 className={vendor.title}>Orders</h1>
      <Segmented options={VIEWS} value={view} onChange={setView} label="Which orders" />
      <SalesList key={view} view={view} />
    </div>
  );
}
