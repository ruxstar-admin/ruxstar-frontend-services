"use client";

import Link from "next/link";
import { Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useStaysDesk } from "@/components/stays/desk";
import { deskTenants, type DeskReservation } from "@/lib/api/stays";
import { dayShort, plural } from "@/lib/stays";
import order from "@/components/shop/order.module.css";

function TenantRow({ item }: { item: DeskReservation }) {
  const bed = item.whole || item.room.kind === "private" ? "Whole room" : `Bed ${item.beds.map((b) => b.label).join(", ")}`;
  const since = item.movedInAt ? `Moved in ${dayShort(item.moveIn)}` : `Moving in ${dayShort(item.moveIn)}`;
  const leaving = item.moveOut ? `${item.moveOut.kind === "notice" ? "Gave notice, leaving" : "Moving out"} ${dayShort(item.moveOut.on)}` : null;
  return (
    <div className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="user" size={20} />
      </span>
      <span className={order.rowText}>
        <Link className={order.rowTitle} href={`/beds/reservations/${item.id}`}>
          {item.tenant.name}
        </Link>
        <span className={order.small}>{[bed, since, leaving].filter(Boolean).join(" · ")}</span>
        {item.tenant.phone && (
          <a className={order.small} href={`tel:${item.tenant.phone}`}>
            <Icon name="phone" size={14} /> {item.tenant.phone}
          </a>
        )}
      </span>
      {item.tenant.verified && <Tag tone="success">KYC verified</Tag>}
      {item.objection?.status === "open" && <Tag tone="danger">Problem raised</Tag>}
    </div>
  );
}

/** Who lives at a property now, room by room, with their phone numbers and any notice given. */
export function DeskTenantsScreen({ id }: { id: string }) {
  const { property } = useStaysDesk(id);
  const { data, error, reload } = useLoad(() => deskTenants(id), id);
  const rooms = new Map<string, { name: string; items: DeskReservation[] }>();
  for (const item of data ?? []) {
    const room = rooms.get(item.room.id) ?? { name: item.room.name, items: [] };
    room.items.push(item);
    rooms.set(item.room.id, room);
  }
  return (
    <div className={order.page}>
      <Back href={`/beds/${id}`}>Bed map</Back>
      <h1 className={order.title}>{property ? `Tenants · ${property.name}` : "Tenants"}</h1>
      {error && !data ? (
        <Failed error={error} onRetry={reload} />
      ) : !data ? (
        <Loading rows={3} />
      ) : data.length === 0 ? (
        <Empty title="No tenants yet">
          <p>Tenants show up here once they’ve paid, room by room.</p>
        </Empty>
      ) : (
        <>
          <p className={order.small}>{plural(data.length, "tenant")}</p>
          {[...rooms.entries()].map(([roomId, room]) => (
            <section key={roomId} className={order.section}>
              <h2 className={order.overline}>{room.name}</h2>
              <div className={order.rows}>
                {room.items.map((item) => (
                  <TenantRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
