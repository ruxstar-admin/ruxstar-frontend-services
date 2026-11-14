import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import type { EventCard as Card } from "@/lib/api/events";
import { coverGradient, initialOf } from "@/lib/api/shops";
import { dayText, KIND_LABEL, placeLine, priceLine, timeText } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import styles from "./events.module.css";

type Photo = { url: string; width: number; height: number } | null;

/** The poster at 16:9, or the title's initial on its own colours when there is none. */
export function Poster({
  photo,
  title,
  eager,
  dimmed,
  className = shop.cover,
  children,
}: {
  photo: Photo;
  title: string;
  eager?: boolean;
  dimmed?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className} data-closed={dimmed || undefined} style={photo ? undefined : { background: coverGradient(title) }}>
      {photo ? (
        <img
          src={photo.url}
          width={photo.width}
          height={photo.height}
          alt={`Poster for ${title}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <span className={shop.initial} aria-hidden>
          {initialOf(title)}
        </span>
      )}
      {children}
    </div>
  );
}

/** "16 NOV" over the poster. */
function DateTag({ iso }: { iso: string }) {
  const [, day, month] = dayText(iso).replace(",", "").split(" ");
  return (
    <span className={styles.dateTag} aria-hidden>
      <span className={styles.dateDay}>{day}</span>
      <span className={styles.dateMonth}>{month?.toUpperCase()}</span>
    </span>
  );
}

/** An event on Discover: the poster with its date, then the title, when, where and price. Same as the app. */
export function EventCard({ event, eager, index }: { event: Card; eager?: boolean; index: number }) {
  const price = priceLine(event);
  return (
    <Link href={`/events/${event.id}`} className={shop.card} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <Poster photo={event.photo} title={event.title} eager={eager} dimmed={event.soldOut}>
        <span className={styles.overlay}>
          <DateTag iso={event.startsAt} />
          {event.soldOut && <span className={styles.soldOut}>Sold out</span>}
        </span>
      </Poster>
      <div className={shop.cardBody}>
        <span className={styles.cardTitle}>{event.title}</span>
        <span className={shop.meta}>{`${dayText(event.startsAt)} · ${timeText(event.startsAt)} · ${event.business.name}`}</span>
        <span className={styles.cardFacts}>
          <span>
            <Icon name={event.online ? "play" : "map-pin"} size={14} />
            {placeLine(event)}
          </span>
          <span>
            <Icon name={event.team ? "users" : "ticket"} size={14} />
            {KIND_LABEL[event.kind]}
          </span>
          <span className={styles.cardPrice} data-free={event.free || undefined}>
            {price}
          </span>
        </span>
      </div>
    </Link>
  );
}
