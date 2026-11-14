"use client";

import Link from "next/link";
import { Button, Icon, Skeleton, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { deskEvents, type DeskEvent } from "@/lib/api/events";
import { dayText, timeText } from "@/lib/events";
import social from "@/components/social/social.module.css";
import order from "@/components/shop/order.module.css";

function DeskRow({ event }: { event: DeskEvent }) {
  return (
    <Link href={`/gate/${event.id}`} className={order.row}>
      <span className={order.rowIcon}>
        <Icon name="ticket" size={22} />
      </span>
      <span className={order.rowText}>
        <span className={order.rowTitle}>{event.title}</span>
        <span className={order.small}>{`${event.business.name} · ${dayText(event.startsAt)}, ${timeText(event.startsAt)}`}</span>
        <span className={order.faint}>{event.today ? `${event.counts.inToday} of ${event.counts.tickets} in today` : `${event.counts.tickets} tickets`}</span>
      </span>
      {event.today && <Tag tone="success">Today</Tag>}
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** Events you can check people in at: your own, and ones where the owner made you a gate keeper. Same as the app. */
export function GateListScreen() {
  const { data, error, reload } = useLoad(() => deskEvents());
  return (
    <div className={order.page}>
      <h1 className={order.title}>Scan tickets</h1>
      {data ? (
        data.items.length ? (
          <ul className={order.rows}>
            {data.items.map((e) => (
              <li key={e.id}>
                <DeskRow event={e} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No events to scan">
            <p>Events on sale show up here: your own, and ones where you’re a gate keeper. Online events have no tickets to scan.</p>
          </Empty>
        )
      ) : error ? (
        <div className={social.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : (
        <div className={order.rows} aria-busy>
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </div>
      )}
    </div>
  );
}
