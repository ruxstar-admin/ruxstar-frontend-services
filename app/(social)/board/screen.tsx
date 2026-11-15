"use client";

import Link from "next/link";
import { Button, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useDesk } from "@/components/turf/desk";
import { formError } from "@/lib/api/account";
import type { DeskGround } from "@/lib/api/turf";
import { GROUND_STATUS } from "@/lib/turf";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

function GroundRow({ ground }: { ground: DeskGround }) {
  const status = GROUND_STATUS[ground.status];
  return (
    <Link href={`/board/${ground.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="ball" size={20} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{ground.name}</span>
        <span className={order.small}>{`${ground.business.name} · ${ground.courts} ${ground.courts === 1 ? "court" : "courts"}`}</span>
      </span>
      {!ground.owner && <Tag>Staff</Tag>}
      {ground.status !== "live" && <Tag tone={status.tone}>{status.label}</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** Grounds for their owner and ground staff: each one opens today's board. Same as the app. */
export function DeskGroundsScreen() {
  const { grounds } = useDesk();
  const { data, error, reload } = grounds;
  return (
    <div className={order.page}>
      <h1 className={order.title}>Grounds</h1>
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
          {data.map((g) => (
            <li key={g.id}>
              <GroundRow ground={g} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No grounds to run">
          <p>Grounds you own, or that an owner adds you to as ground staff, show up here.</p>
        </Empty>
      )}
    </div>
  );
}
