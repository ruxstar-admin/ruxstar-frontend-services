"use client";

import { useCallback, useEffect, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { StoreOrderRow } from "@/components/store/StoreOrderRow";
import { ButtonLink, Icon, Segmented, Skeleton } from "@/components/ui";
import { consoleOrders, type ConsoleOrder, type ConsoleOrderFilters } from "@/lib/api/store";
import order from "@/components/shop/order.module.css";

type View = "all" | "open" | "returns" | "rejected" | "cancelled";

const VIEWS: { value: View; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Waiting for the shop" },
  { value: "returns", label: "Open returns" },
  { value: "rejected", label: "Returns turned down" },
  { value: "cancelled", label: "Cancelled" },
];

const filterOf = (view: View, shop?: string): ConsoleOrderFilters => ({
  ...(shop ? { shop } : {}),
  ...(view === "open" ? { status: "paid" } : view === "cancelled" ? { status: "cancelled" } : {}),
  ...(view === "returns" ? { returns: "open" } : view === "rejected" ? { returns: "rejected" } : {}),
});

function Results({ filter }: { filter: ConsoleOrderFilters }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => consoleOrders(filter, cursor), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<ConsoleOrder>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>No orders here.</p>;

  return (
    <>
      <ul className={order.rows}>
        {items.map((o) => (
          <StoreOrderRow key={o.id} href={`/admin/store-orders/${o.id}`} order={o} subtitle={`${o.business.name} · ${o.customer.name}`} amount={o.price.total} forShop />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </>
  );
}

/** Local shop orders, newest first: new ones waiting for a shop, returns that hold a shop's money, and returns a shop turned down. */
export function StoreOrdersScreen({ shop, openReturns }: { shop?: string; openReturns?: boolean }) {
  const [view, setView] = useState<View>(openReturns ? "returns" : "all");
  const filter = filterOf(view, shop);

  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <h1 className={styles.title}>Shop orders</h1>
        {shop && (
          <div className={styles.actions}>
            <ButtonLink href={`/admin/stores/${shop}`} variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
              Back to the shop
            </ButtonLink>
            <ButtonLink href="/admin/store-orders" variant="ghost">
              Every shop’s orders
            </ButtonLink>
          </div>
        )}
        <div className={styles.toolbar}>
          <Segmented label="Show" options={VIEWS} value={view} onChange={setView} />
        </div>
        <Results key={`${view}:${shop ?? ""}`} filter={filter} />
      </div>
    </Needs>
  );
}
