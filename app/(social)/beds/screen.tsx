"use client";

import Link from "next/link";
import { Button, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useStaysDesk } from "@/components/stays/desk";
import { formError } from "@/lib/api/account";
import type { DeskProperty } from "@/lib/api/stays";
import { KIND_LABEL, plural, PROPERTY_STATUS } from "@/lib/stays";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

function PropertyRow({ property }: { property: DeskProperty }) {
  const status = PROPERTY_STATUS[property.status];
  return (
    <Link href={`/beds/${property.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="bed" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{property.name}</span>
        <span className={order.small}>{`${KIND_LABEL[property.kind]} · ${property.business.name} · ${plural(property.rooms, "room")}, ${plural(property.beds, "bed")}`}</span>
      </span>
      {!property.owner && <Tag>Warden</Tag>}
      {property.status !== "live" && <Tag tone={status.tone}>{status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** PGs and hostels for their owner and wardens: each one opens its bed map. */
export function DeskPropertiesScreen() {
  const { properties } = useStaysDesk();
  const { data, error, reload } = properties;
  return (
    <div className={order.page}>
      <h1 className={order.title}>Properties</h1>
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
          {data.map((p) => (
            <li key={p.id}>
              <PropertyRow property={p} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No properties to run">
          <p>PGs and hostels you own, or that an owner adds you to as a warden, show up here.</p>
        </Empty>
      )}
    </div>
  );
}
