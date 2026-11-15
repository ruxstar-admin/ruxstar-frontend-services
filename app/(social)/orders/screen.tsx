"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Segmented } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { OrderRow } from "@/components/shop/OrderParts";
import { StoreOrderRow } from "@/components/store/StoreOrderRow";
import { formError } from "@/lib/api/account";
import { myOrders, STATUS_LABEL } from "@/lib/api/orders";
import { myStoreOrders } from "@/lib/api/store";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";

type Tab = "print" | "shops";
const TABS = [
  { value: "print", label: "Print" },
  { value: "shops", label: "Shops" },
] as const satisfies readonly { value: Tab; label: string }[];

const loadStoreOrders = (cursor?: string) => myStoreOrders("all", cursor);

function PrintOrders() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(myOrders);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return loading ? (
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
  );
}

function ShopOrders() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages(loadStoreOrders);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return loading ? (
    <SkeletonRows />
  ) : error && items.length === 0 ? (
    <div className={social.failed} role="alert">
      <p>{formError(error).message}</p>
      <Button variant="secondary" onClick={reload}>
        Try again
      </Button>
    </div>
  ) : items.length === 0 ? (
    <Empty title="No shop orders yet">
      <p>Local shops near you are on Discover. Order for delivery, or pick it up yourself.</p>
      <ButtonLink href="/discover?category=shop" variant="secondary">
        Find shops
      </ButtonLink>
    </Empty>
  ) : (
    <ul className={styles.rows}>
      {items.map((o) => (
        <StoreOrderRow key={o.id} href={`/orders/shop/${o.id}`} order={o} subtitle={o.business.name} amount={o.price.total} />
      ))}
      {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <SkeletonRows count={1} />}
    </ul>
  );
}

/** Your print orders and local shop orders, newest first. */
export function OrdersScreen({ tab: initial }: { tab: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);

  const pick = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", next === "shops" ? "/orders?tab=shops" : "/orders");
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your orders</h1>
      <Segmented label="Which orders" options={TABS} value={tab} onChange={pick} />
      {tab === "shops" ? <ShopOrders /> : <PrintOrders />}
    </div>
  );
}
