"use client";

import { useState } from "react";
import { Button, ButtonLink, Icon, Segmented, Skeleton } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Back } from "@/components/vendor/parts";
import { deskBack, useStoreDesk } from "@/components/store/desk";
import { StoreOrderRow } from "@/components/store/StoreOrderRow";
import { formError } from "@/lib/api/account";
import { deskOrders, type DeskOrdersView } from "@/lib/api/store";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "returns", label: "Returns" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
] as const;

const EMPTY: Record<DeskOrdersView, { title: string; line: string }> = {
  open: { title: "No open orders", line: "Paid orders show up here as soon as customers pay. Accept them in time, or they’re refunded." },
  returns: { title: "No returns", line: "Returns customers ask for show up here until they’re settled." },
  done: { title: "Nothing done yet", line: "Delivered, picked up and cancelled orders show up here." },
  all: { title: "No orders yet", line: "Every order at this shop shows up here." },
};

function Orders({ shopId, view }: { shopId: string; view: DeskOrdersView }) {
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor) => deskOrders(shopId, view, cursor));
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
        {items.map((o) => (
          <StoreOrderRow key={o.id} href={`/store/orders/${o.id}`} order={o} subtitle={o.customer.name} amount={o.price.total} forShop />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} className={social.sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={84} radius={16} />}
    </>
  );
}

/** A local shop's orders for its owner and team: new ones to accept, ones to pack and send, returns, and the rest. */
export function DeskOrdersScreen({ id }: { id: string }) {
  const { stores, store, can } = useStoreDesk(id);
  const [view, setView] = useState<DeskOrdersView>("open");
  const back = deskBack(store, id);

  if (stores.data && !store) {
    return (
      <Empty title="Not open to you">
        <p>This shop isn’t one you own or work at.</p>
        <ButtonLink href="/store" variant="secondary">
          Shops
        </ButtonLink>
      </Empty>
    );
  }
  return (
    <div className={order.page}>
      <Back href={back.href}>{back.label}</Back>
      <div className={order.titleRow}>
        <h1 className={order.title}>{store ? store.name : "Orders"}</h1>
        {(can("store.stock") || can("store.products")) && (
          <ButtonLink href={`/store/${id}/products`} variant="secondary" icon={<Icon name="tag" size={16} />}>
            Products & stock
          </ButtonLink>
        )}
      </div>
      {store && !can("store.orders") ? (
        <Empty title="Orders aren’t open to you">
          <p>The owner hasn’t let you see orders here.</p>
        </Empty>
      ) : (
        <>
          <Segmented label="Which orders" options={VIEWS} value={view} onChange={setView} />
          <Orders key={view} shopId={id} view={view} />
        </>
      )}
    </div>
  );
}
