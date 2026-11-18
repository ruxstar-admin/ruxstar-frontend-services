"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Needs } from "@/components/admin/AdminFrame";
import { Failed, MoreFailed, Rows, styles } from "@/components/admin/parts";
import { GigOrderRow } from "@/components/gigs/GigOrderRow";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { ButtonLink, Icon, Input, Segmented, Skeleton } from "@/components/ui";
import { consoleGigOrders, type ConsoleGigOrdersQuery, type GigOrder, type GigOrderStatus } from "@/lib/api/gigs";
import order from "@/components/shop/order.module.css";

type Status = GigOrderStatus | "all";

const STATUSES: { value: Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "disputed", label: "Problems" },
  { value: "paid", label: "Waiting to accept" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "awaiting_payment", label: "Not paid" },
];

function Results({ query }: { query: ConsoleGigOrdersQuery }) {
  const onSignedOut = useOnSignedOut();
  const [now] = useState(Date.now);
  const load = useCallback((cursor?: string) => consoleGigOrders(query, cursor), [query]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages<GigOrder>(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows count={5} />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {query.status === "disputed" ? "No problems waiting. Problems customers report show up here for a refund decision." : "No freelance orders here."}
      </p>
    );
  }

  return (
    <>
      <ul className={order.rows}>
        {items.map((o) => (
          <GigOrderRow key={o.id} href={`/admin/gig-orders/${o.id}`} order={o} subtitle={`${o.freelancer.name} → ${o.customer.name}`} amount={o.price.total} now={now} />
        ))}
      </ul>
      {hasMore && <div ref={sentinel} aria-hidden />}
      {moreFailed && <MoreFailed onRetry={more} />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </>
  );
}

/** Every freelance order, or one freelancer's, by status, order number or words; problems wait here for a decision. */
export function GigOrdersScreen({ freelancer, label, status: initial }: { freelancer?: string; label?: string; status?: string }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>(() => STATUSES.find((s) => s.value === initial)?.value ?? "all");

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const query = useMemo<ConsoleGigOrdersQuery>(() => ({ ...(freelancer ? { freelancer } : {}), ...(q ? { q } : {}), ...(status === "all" ? {} : { status }) }), [freelancer, q, status]);

  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <h1 className={styles.title}>{label ? `${label}: orders` : "Freelance orders"}</h1>
        {freelancer && (
          <div className={styles.actions}>
            <ButtonLink href={`/admin/freelancers/${freelancer}`} variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
              Back to the freelancer
            </ButtonLink>
            <ButtonLink href="/admin/gig-orders" variant="ghost">
              Every freelance order
            </ButtonLink>
          </div>
        )}
        <div className={styles.toolbar}>
          <Input label="Find an order" placeholder="Order number or title" type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
        </div>
        <Segmented label="Show" options={STATUSES} value={status} onChange={setStatus} />
        <Results key={JSON.stringify(query)} query={query} />
      </div>
    </Needs>
  );
}
