import type { VendorEvent } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import { soldLine } from "@/lib/events";
import vendor from "@/components/vendor/vendor.module.css";
import styles from "./events.module.css";

/** Tickets, today's check-ins and the organiser's share, then sold out of capacity for each ticket type. Drafts show only the ticket types. */
export function EventSales({ event, shareLabel }: { event: VendorEvent; shareLabel: string }) {
  return (
    <>
      {event.status !== "draft" && (
        <section className={vendor.card}>
          <dl className={vendor.stats}>
            <div>
              <dt>Tickets</dt>
              <dd>{event.counts.tickets}</dd>
            </div>
            <div>
              <dt>In today</dt>
              <dd>{event.counts.checkedIn}</dd>
            </div>
            <div>
              <dt>{shareLabel}</dt>
              <dd>{money(event.money.share)}</dd>
            </div>
          </dl>
        </section>
      )}
      <section className={vendor.card} aria-label="Ticket types">
        <strong>{soldLine(event)}</strong>
        <ul className={styles.tiers} data-plain>
          {event.tiers.map((t) => (
            <li key={t.id} className={styles.tierRow}>
              <span className={styles.tierText}>
                <span className={styles.tierName}>{t.name}</span>
                <span className={vendor.muted}>{`${t.price ? money(t.price) : "Free"}${t.held ? ` · ${t.held} being paid for` : ""}`}</span>
              </span>
              <span className={styles.tierName}>{`${t.sold} / ${t.capacity}`}</span>
            </li>
          ))}
        </ul>
        {event.counts.waiting > 0 && <span className={vendor.muted}>{`${event.counts.waiting} on the waitlist`}</span>}
      </section>
    </>
  );
}
