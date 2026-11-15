"use client";

import Link from "next/link";
import { Button, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useStoreDesk } from "@/components/store/desk";
import { formError } from "@/lib/api/account";
import type { DeskStore } from "@/lib/api/store";
import { plural } from "@/lib/store";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

function StoreRow({ store }: { store: DeskStore }) {
  const line = [store.open ? plural(store.open, "open order") : "No open orders", store.returns ? plural(store.returns, "return") : null].filter(Boolean).join(" · ");
  return (
    <Link href={`/store/${store.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="bag" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{store.name}</span>
        <span className={order.small}>{line}</span>
      </span>
      {!store.owner && <Tag>Team</Tag>}
      {store.open > 0 && <Tag tone="warning">{String(store.open)}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** Local shops for their owner and team: each one opens its orders. */
export function DeskStoresScreen() {
  const { stores } = useStoreDesk();
  const { data, error, reload } = stores;
  return (
    <div className={order.page}>
      <h1 className={order.title}>Shop desk</h1>
      {error && !data ? (
        <div className={social.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <div className={order.rows} aria-busy>
          <Skeleton height={72} radius={16} />
          <Skeleton height={72} radius={16} />
        </div>
      ) : data.length ? (
        <ul className={order.rows}>
          {data.map((s) => (
            <li key={s.id}>
              <StoreRow store={s} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No shops to run">
          <p>Local shops you own, or that an owner adds you to, show up here.</p>
        </Empty>
      )}
    </div>
  );
}
