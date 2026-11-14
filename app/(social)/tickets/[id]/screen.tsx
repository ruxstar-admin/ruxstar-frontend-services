"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { TicketPass } from "@/components/events/TicketPass";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { cancelTickets, getTicketOrder, payTickets, type TicketOrder } from "@/lib/api/events";
import { money } from "@/lib/api/shops";
import { dayText, linesText, ORDER_STATUS, timeText, whenLine } from "@/lib/events";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import styles from "@/components/events/events.module.css";

/** While it waits for payment, each look also asks Cashfree whether it was paid. */
const POLL_MS = 8000;

function OrderView({ booking, fresh, onChanged }: { booking: TicketOrder; fresh: boolean; onChanged: (next: TicketOrder) => void }) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelKey = useRef(newIdempotencyKey());
  const status = ORDER_STATUS[booking.status];
  const unpaid = booking.status === "awaiting_payment";
  const { event } = booking;

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await payTickets(booking.id, `${window.location.origin}/tickets`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setPaying(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    try {
      onChanged(await cancelTickets(booking.id, cancelKey.current));
      setConfirming(false);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setCancelling(false);
    }
  };

  const valid = booking.tickets.filter((t) => t.status === "valid");
  const showsPasses = !(event.online && booking.status === "confirmed");
  const total = booking.price.total;

  return (
    <div className={order.page}>
      {fresh && booking.status === "confirmed" && (
        <div className={styles.wait} data-offered role="status">
          <strong>You’re going! Share each ticket with the person it’s for.</strong>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            <Link href={`/events/${event.id}`} className={styles.titleLink}>
              {event.title}
            </Link>
          </h1>
          <p className={order.small}>{whenLine(event.startsAt, event.endsAt)}</p>
          <p className={order.small}>{event.online ? "Online" : [event.venueName, event.address].filter(Boolean).join(", ")}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {unpaid && booking.payBy && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>{`Pay by ${timeText(booking.payBy)} or the tickets go back on sale.`}</p>
        </div>
      )}
      {event.cancelled && (
        <div className={order.news}>
          <strong>Event cancelled</strong>
          <p className={order.small}>The organiser cancelled this event. Everything you paid is refunded.</p>
        </div>
      )}
      {booking.refund && (
        <div className={order.news}>
          <p className={order.small}>
            {booking.refund.status === "done"
              ? `${money(booking.refund.amount)} refunded to how you paid. Banks take up to 7 days to show it.`
              : `Refunding ${money(booking.refund.amount)}…`}
          </p>
        </div>
      )}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      {unpaid && (
        <Button size="lg" loading={paying} onClick={() => void pay()}>
          {`Pay ${money(total)}`}
        </Button>
      )}

      {booking.status === "confirmed" && event.online && event.onlineLink && (
        <ButtonLink href={event.onlineLink} target="_blank" rel="noreferrer" size="lg" icon={<Icon name="play" size={18} />}>
          Join online
        </ButtonLink>
      )}

      {showsPasses && (
        <div className={styles.passes}>
          {booking.tickets.map((t, i) => (
            <TicketPass key={t.id} ticket={t} title={event.title} startsAt={event.startsAt} index={i} total={booking.tickets.length} />
          ))}
        </div>
      )}

      <div className={order.panel}>
        <span className={order.faint}>{`Booking #${booking.orderNo}`}</span>
        <span>{booking.team ? `${booking.team} · ${booking.tickets.length} players` : linesText(booking.lines)}</span>
        <span>
          {total
            ? `${money(total)}${unpaid ? " to pay" : ""}${booking.price.platformFee ? `, including a ${money(booking.price.platformFee)} fee` : ""}`
            : "Free"}
        </span>
        <span className={order.faint}>{`By ${booking.business.name}`}</span>
      </div>

      <InvoiceLinks refs={booking.invoices} audience="customer" />

      {booking.canCancel &&
        valid.length > 0 &&
        (confirming ? (
          <div className={order.news}>
            <strong>Cancel this booking?</strong>
            <p className={order.small}>
              {total
                ? `All ${booking.tickets.length} tickets are cancelled and ${money(total)} goes back to how you paid.${
                    booking.cancelUntil ? ` You can do this until ${dayText(booking.cancelUntil)}, ${timeText(booking.cancelUntil)}.` : ""
                  }`
                : `All ${booking.tickets.length} tickets are cancelled and the seats go to someone else.`}
            </p>
            <div className={order.actions}>
              <Button variant="danger" loading={cancelling} onClick={() => void cancel()}>
                Cancel booking
              </Button>
              <Button variant="ghost" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.textLink} data-danger onClick={() => setConfirming(true)}>
            {total ? "Cancel and get a refund" : "Cancel my tickets"}
          </button>
        ))}
    </div>
  );
}

/** One booking: every person's QR ticket to show or share, paying if it isn't paid, and cancelling while refunds are open. Same as the app. */
export function TicketOrderScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [booking, setBooking] = useState<TicketOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const waiting = booking?.status === "awaiting_payment";

  const load = useCallback(
    () =>
      getTicketOrder(id).then(
        (o) => {
          setBooking(o);
          setError(null);
        },
        (err: unknown) => !onSignedOut(err) && setError(err),
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  if (booking) return <OrderView booking={booking} fresh={fresh} onChanged={setBooking} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Booking not found" : "Could not load this booking"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/tickets" variant="secondary">
            Your tickets
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
