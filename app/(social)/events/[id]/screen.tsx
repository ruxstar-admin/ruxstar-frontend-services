"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useMe, useSignInFirst } from "@/components/social/session";
import { Poster } from "@/components/events/EventCard";
import { Stepper } from "@/components/events/Stepper";
import { formError, isSignedOut } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { getEvent, joinWaitlist, leaveWaitlist, type EventDetail, type MyWait, type PublicEvent } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import { dayText, KIND_LABEL, mapsUrl, placeLine, priceLine, refundText, timeText, whenLine } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

/** Shown as "12 left" once this few remain. */
const FEW_LEFT = 20;

function Fact({ icon, title, detail }: { icon: "calendar" | "map-pin" | "play" | "users"; title: string; detail?: string | null }) {
  return (
    <div className={styles.factRow}>
      <Icon name={icon} size={18} />
      <span className={styles.factText}>
        <strong>{title}</strong>
        {detail && <span className={order.small}>{detail}</span>}
      </span>
    </div>
  );
}

function WaitCard({ wait, tierName, eventId, onLeave }: { wait: MyWait; tierName: string; eventId: string; onLeave: () => void }) {
  const offered = wait.status === "offered";
  return (
    <div className={styles.wait} data-offered={offered || undefined}>
      <strong>{offered ? `${wait.quantity} × ${tierName} held for you` : `You’re #${wait.position} on the waitlist for ${tierName}`}</strong>
      <p className={order.small}>
        {offered && wait.offeredUntil
          ? `Book before ${dayText(wait.offeredUntil)}, ${timeText(wait.offeredUntil)} or they go to the next person.`
          : "We’ll tell you as soon as tickets free up. You don’t pay anything until then."}
      </p>
      <div>
        {offered ? (
          <ButtonLink href={`/events/${eventId}/book?waitlist=${wait.id}`}>Book them now</ButtonLink>
        ) : (
          <button type="button" className={styles.textLink} onClick={onLeave}>
            Leave the waitlist
          </button>
        )}
      </div>
    </div>
  );
}

function JoinWaitlist({ event, onJoined, onClose }: { event: PublicEvent; onJoined: () => void; onClose: () => void }) {
  const [tierId, setTierId] = useState(event.tiers.find((t) => t.soldOut)?.id ?? event.tiers[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinWaitlist(event.id, tierId, event.team ? 1 : quantity, key.current);
      onJoined();
    } catch (err) {
      setError(formError(err).message);
      setBusy(false);
    }
  };

  return (
    <div className={order.news}>
      <strong>Join the waitlist</strong>
      <p className={order.small}>
        When tickets free up, they’re offered in the order people joined. You’ll get a notification, and they’re held for you for a limited time.
        This page shows until when.
      </p>
      {event.tiers.length > 1 && (
        <div className={styles.chips} role="group" aria-label="Ticket type">
          {event.tiers.map((t) => (
            <button key={t.id} type="button" className={shop.subChip} aria-pressed={tierId === t.id} onClick={() => setTierId(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      {!event.team && (
        <div className={styles.tierRow}>
          <span className={styles.tierText}>
            <span className={styles.tierName}>How many</span>
          </span>
          <Stepper value={quantity} min={1} max={event.maxPerOrder} onChange={setQuantity} label="tickets" />
        </div>
      )}
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}
      <div className={order.actions}>
        <Button loading={busy} onClick={() => void join()}>
          Join the waitlist
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}

function EventView({ event, mine, signedOut, onChanged }: { event: PublicEvent; mine: EventDetail | null; signedOut: boolean; onChanged: () => void }) {
  const signIn = useSignInFirst();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState<MyWait | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyLeft = event.tiers.some((t) => !t.soldOut);
  const allFree = event.tiers.every((t) => t.price === 0);
  const myOrders = mine?.myOrders ?? [];
  const myWaits = mine?.myWaits ?? [];
  const offered = myWaits.find((w) => w.status === "offered");
  const tierName = (id: string) => event.tiers.find((t) => t.id === id)?.name ?? "tickets";

  const leave = async () => {
    if (!leaving) return;
    setBusy(true);
    setError(null);
    try {
      await leaveWaitlist(leaving.id);
      setLeaving(null);
      onChanged();
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const action = (() => {
    if (event.status !== "live" || offered || joining) return null;
    if (signedOut) return <Button onClick={signIn}>Sign in to get tickets</Button>;
    if (!mine) return null;
    if (!event.canBuy) return <Button disabled>{event.whyNot ?? "Tickets aren’t on sale"}</Button>;
    if (anyLeft)
      return <ButtonLink href={`/events/${event.id}/book`}>{myOrders.length ? "Get more tickets" : allFree ? "Get free tickets" : "Get tickets"}</ButtonLink>;
    return <Button onClick={() => setJoining(true)}>Join the waitlist</Button>;
  })();

  return (
    <div className={order.page}>
      <Poster photo={event.photo} title={event.title} eager dimmed={event.status !== "live"} className={styles.poster} />
      <div className={shop.head}>
        <div>
          <Tag>{KIND_LABEL[event.kind]}</Tag>
        </div>
        <h1 className={styles.eventTitle}>{event.title}</h1>
        <p className={styles.byLine}>{`By ${event.business.name}`}</p>
      </div>

      {event.status === "cancelled" ? (
        <div className={order.news} role="status">
          <strong>Cancelled</strong>
          <p className={order.small}>{`${event.cancelReason ? `${event.cancelReason} ` : ""}Everyone who paid gets a full refund.`}</p>
        </div>
      ) : event.status === "ended" ? (
        <div className={order.news} role="status">
          <strong>This event is over.</strong>
        </div>
      ) : null}

      {myOrders.length > 0 && (
        <ul className={order.rows}>
          {myOrders.map((o) => (
            <li key={o.id}>
              <Link href={`/tickets/${o.id}`} className={order.row}>
                <span className={order.rowIcon}>
                  <Icon name="ticket" size={20} />
                </span>
                <span className={order.rowText}>
                  <span className={order.rowTitle}>
                    {o.status === "awaiting_payment" ? "Finish paying for your tickets" : `Your ${o.tickets === 1 ? "ticket" : `${o.tickets} tickets`}`}
                  </span>
                  <span className={order.small}>{`Booking #${o.orderNo}`}</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {myWaits.map((w) => (
        <WaitCard key={w.id} wait={w} tierName={tierName(w.tierId)} eventId={event.id} onLeave={() => setLeaving(w)} />
      ))}

      {leaving && (
        <div className={order.news}>
          <strong>Leave the waitlist?</strong>
          <p className={order.small}>You’ll lose your place in the queue.</p>
          <div className={order.actions}>
            <Button variant="danger" loading={busy} onClick={() => void leave()}>
              Leave
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setLeaving(null)}>
              Stay on it
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      <div className={shop.panel}>
        <Fact icon="calendar" title={whenLine(event.startsAt, event.endsAt)} />
        {event.online ? (
          <Fact icon="play" title="Online" detail={event.onlineLink ? "The link is on your ticket." : "You get the link with your ticket."} />
        ) : (
          <Fact icon="map-pin" title={event.venue?.name ?? placeLine(event)} detail={event.venue ? `${event.venue.address}, ${event.venue.city}` : null} />
        )}
        {event.teamSize && (
          <Fact
            icon="users"
            title={`Teams of ${event.teamSize.min === event.teamSize.max ? event.teamSize.min : `${event.teamSize.min} to ${event.teamSize.max}`}`}
            detail="The captain books and pays once for the team. Every player gets their own QR code."
          />
        )}
        {event.venue && !event.online && (
          <a className={styles.textLink} href={mapsUrl(event.venue)} target="_blank" rel="noreferrer">
            Open in maps
          </a>
        )}
      </div>

      <section className={order.section}>
        <h2 className={order.overline}>Tickets</h2>
        <ul className={styles.tiers}>
          {event.tiers.map((t) => (
            <li key={t.id} className={styles.tierRow}>
              <span className={styles.tierText}>
                <span className={styles.tierName}>{t.name}</span>
                <span className={styles.seats} data-out={t.soldOut || undefined} data-low={(!t.soldOut && t.left <= FEW_LEFT) || undefined}>
                  {t.soldOut ? "Sold out" : t.left <= FEW_LEFT ? `Only ${t.left} left` : "Available"}
                </span>
              </span>
              <span className={shop.price}>{t.price === 0 ? "Free" : `${money(t.price)}${event.team ? " / team" : ""}`}</span>
            </li>
          ))}
        </ul>
        {!allFree && event.platformFee > 0 && <p className={order.faint}>{`Plus a ${money(event.platformFee)} platform fee per booking.`}</p>}
        <div className={styles.factRow}>
          <Icon name="shield" size={18} />
          <span>{refundText(event.refunds, allFree)}</span>
        </div>
      </section>

      {event.description && (
        <section className={order.section}>
          <h2 className={order.overline}>About</h2>
          <p className={shop.text}>{event.description}</p>
        </section>
      )}

      {joining && (
        <JoinWaitlist
          event={event}
          onClose={() => setJoining(false)}
          onJoined={() => {
            setJoining(false);
            onChanged();
          }}
        />
      )}

      {action && (
        <div className={shop.orderBar}>
          <span className={shop.orderText}>
            <strong>{priceLine(event)}</strong>
            <span className={order.faint}>{dayText(event.startsAt)}</span>
          </span>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * One event: poster, when and where, ticket types and refunds. The page arrives with the event already in it when
 * the API shares it publicly; seats left, your bookings and waitlist places always load here. Same as the app.
 */
export function EventScreen({ id, initial }: { id: string; initial: PublicEvent | null }) {
  const me = useMe();
  const signIn = useSignInFirst();
  const [full, setFull] = useState<EventDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getEvent(id).then(
        (e) => {
          setFull(e);
          setError(null);
        },
        (err: unknown) => setError(err),
      ),
    [id],
  );

  useEffect(() => {
    if (me === undefined || me === null) return;
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [me, load]);

  const signedOut = me === null || isSignedOut(error);
  const event = full ?? initial;
  if (event) return <EventView event={event} mine={full} signedOut={signedOut} onChanged={() => void load()} />;
  if (signedOut) {
    return (
      <Empty title="Sign in to see this event">
        <p>Events and tickets are for people with a Ruxstar account.</p>
        <Button onClick={signIn}>Sign in</Button>
      </Empty>
    );
  }
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Event not found" : "Could not load this event"}>
        <p>{gone ? "It may have been taken down or the link is wrong." : formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/discover?category=events" variant="secondary">
            Find events
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }
  return (
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
