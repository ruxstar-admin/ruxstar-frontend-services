"use client";

import Link from "next/link";
import { ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { businessEvents, type VendorEvent } from "@/lib/api/events";
import { dayText, EVENT_STATUS, soldLine, timeText } from "@/lib/events";
import styles from "@/components/vendor/vendor.module.css";

function EventRow({ event }: { event: VendorEvent }) {
  const status = EVENT_STATUS[event.status];
  return (
    <Link href={`/vendor/events/${event.id}`} className={styles.row}>
      <Icon name="calendar" size={20} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{event.title}</span>
        <span className={styles.rowLine}>{`${dayText(event.startsAt)} · ${timeText(event.startsAt)}`}</span>
        <span className={styles.rowLine}>
          {event.status === "draft" ? (event.missing.length ? `To do: ${event.missing[0]}` : "Ready to publish") : soldLine(event)}
        </span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      <Icon name="chevron-right" size={18} />
    </Link>
  );
}

/** A business's events, newest first, and the way to make a new one. Same as the app. */
export function BusinessEventsScreen({ id }: { id: string }) {
  const { data, error, reload } = useLoad(() => businessEvents(id), id);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={3} />;
  const create = `/vendor/businesses/${id}/events/new`;

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${id}`}>Business</Back>
      <div className={styles.head}>
        <h1 className={styles.title}>Events</h1>
        {data.items.length > 0 && (
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New event
          </ButtonLink>
        )}
      </div>
      {data.items.length ? (
        <ul className={styles.rows}>
          {data.items.map((e) => (
            <li key={e.id}>
              <EventRow event={e} />
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No events yet">
          <p>Make your first one. It’s saved as a draft until you publish it.</p>
          <ButtonLink href={create} icon={<Icon name="plus" size={18} />}>
            New event
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
