"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { formError } from "@/lib/api/account";
import { ApiError, keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { cancelBooking, getBooking, payBooking, type Occurrence, type TurfBooking } from "@/lib/api/turf";
import { offerWord } from "@/lib/coupons";
import { BOOKING_STATUS, directionsUrl, GROUND_CANCELS, PER_LABEL, timeText, weeksText, whenText } from "@/lib/turf";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/turf/turf.module.css";

/** While it waits for payment, each look also asks Cashfree whether it was paid. */
const POLL_MS = 8000;

/** Its own chunk: only bookings that can have a review download it. */
const Rate = dynamic(() => import("@/components/reviews/Reviews").then((m) => m.Rate));

/** Reviews open once a date has been played; before that there's nothing to look up. */
const mayHaveReview = (b: TurfBooking, now: number) =>
  b.status === "confirmed" && (!!b.canReview || b.occurrences.some((o) => o.status === "booked" && (Date.parse(o.endAt) <= now || o.arrival === "arrived")));

function dateLine(o: Occurrence): string {
  if (o.status === "cancelled") {
    const by = o.cancelledBy === "ground" ? "Cancelled by the ground" : o.cancelledBy === "ruxstar" ? "Cancelled by Ruxstar" : "Cancelled";
    return o.refund && o.refund.amount > 0 ? `${by} · ${money(o.refund.amount)} back` : by;
  }
  if (o.arrival === "arrived") return "Played";
  if (o.arrival === "no_show") return "Marked as not turned up";
  return money(o.paid);
}

function DateRow({ o, picking, picked, onToggle }: { o: Occurrence; picking: boolean; picked: boolean; onToggle: () => void }) {
  const text = (
    <span className={order.rowText}>
      <span className={o.status === "cancelled" ? `${order.rowTitle} ${styles.struck}` : order.rowTitle}>
        {whenText(o.startAt, o.endAt)}
      </span>
      <span className={order.faint}>{dateLine(o)}</span>
      {o.cancelReason && <span className={order.faint}>{o.cancelReason}</span>}
    </span>
  );
  if (picking && o.canCancel) {
    const back = o.refundIfCancelled;
    return (
      <label className={`${order.row} ${styles.pickRow}`}>
        <input type="checkbox" checked={picked} onChange={onToggle} />
        {text}
        <span className={order.rowEnd}>{back && back.amount > 0 ? `${money(back.amount)} back` : "No refund"}</span>
      </label>
    );
  }
  return (
    <div className={order.row}>
      <span className={order.rowIcon}>
        <Icon name={o.status === "cancelled" ? "close" : o.arrival === "arrived" ? "check" : "calendar"} size={20} />
      </span>
      {text}
    </div>
  );
}

function BookingView({ item, fresh, onChanged }: { item: TurfBooking; fresh: boolean; onChanged: (next: TurfBooking) => void }) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const cancelKey = useRef<{ sig: string; key: string } | null>(null);
  const status = BOOKING_STATUS[item.status];
  const unpaid = item.status === "awaiting_payment";
  const confirmed = item.status === "confirmed";
  const open = item.occurrences.filter((o) => o.canCancel);
  const total = item.price.total;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await payBooking(item.id, `${window.location.origin}/bookings`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setPaying(false);
    }
  };

  const startCancel = () => {
    setPicked(open.map((o) => o.n));
    setConfirming(true);
  };
  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort((a, b) => a - b)));
  const all = unpaid || picked.length === open.length;
  const refund = open.filter((o) => picked.includes(o.n)).reduce((sum, o) => sum + (o.refundIfCancelled?.amount ?? 0), 0);

  const cancel = async () => {
    setCancelling(true);
    setError(null);
    const body = all ? {} : { occurrences: picked };
    const sig = JSON.stringify(body);
    if (cancelKey.current?.sig !== sig) cancelKey.current = { sig, key: newIdempotencyKey() };
    try {
      onChanged(await cancelBooking(item.id, body, cancelKey.current.key));
      setConfirming(false);
      cancelKey.current = null;
    } catch (err) {
      setError(formError(err).message);
      if (!keepIdempotencyKey(err)) cancelKey.current = null;
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={order.page}>
      {fresh && confirmed && (
        <div className={events.wait} data-offered role="status">
          <strong>You’re booked. See you on the court!</strong>
          <p className={order.small}>The ground has your booking. We’ll tell you if anything changes.</p>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            <Link href={`/grounds/${item.ground.id}`} className={events.titleLink}>
              {item.ground.name}
            </Link>
          </h1>
          <p className={order.small}>{[item.court.name, item.sport?.name].filter(Boolean).join(" · ")}</p>
          <p className={order.small}>{item.weeks > 1 ? `Weekly, ${weeksText(item.weeks)}` : whenText(item.firstAt, item.occurrences[0]!.endAt)}</p>
          <p className={order.small}>{`${item.ground.address}, ${item.ground.city}`}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {unpaid && item.payBy && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>{`Pay by ${timeText(item.payBy)} or the slots go back.`}</p>
        </div>
      )}
      {item.ground.removed && (
        <div className={order.news}>
          <strong>Ground taken down</strong>
          <p className={order.small}>Ruxstar took this ground down. Dates that hadn’t started are cancelled and refunded in full.</p>
        </div>
      )}
      {item.status === "cancelled" && item.reason && <p className={order.small}>{item.reason}</p>}
      {item.refunds.map((r, i) => (
        <div key={i} className={order.news}>
          <p className={order.small}>
            {r.status === "done" ? `${money(r.amount)} refunded to how you paid. Banks take up to 7 days to show it.` : `Refunding ${money(r.amount)}…`}
          </p>
        </div>
      ))}

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

      {confirmed && (
        <a
          className={events.textLink}
          href={directionsUrl({ name: item.ground.name, address: item.ground.address, city: item.ground.city, point: item.ground.point })}
          target="_blank"
          rel="noreferrer"
        >
          Get directions
        </a>
      )}

      {mayHaveReview(item, now) && (
        <Rate
          orderId={item.id}
          module="turf"
          open={!!item.canReview}
          until={item.reviewUntil ?? null}
          words={{
            ask: "Rate this ground",
            askLine: `How was the game? Your review helps other players choose ${item.ground.name}.`,
            writeTitle: `Rate ${item.ground.name}`,
            placeholder: "The surface, the lights, the staff, how easy it was to find",
          }}
        />
      )}

      <section className={order.section}>
        <h2 className={order.overline}>{item.weeks > 1 ? `Dates · ${item.occurrences.length}` : "When"}</h2>
        <div className={order.rows}>
          {item.occurrences.map((o) => (
            <DateRow key={o.n} o={o} picking={confirming && !unpaid && open.length > 1} picked={picked.includes(o.n)} onToggle={() => toggle(o.n)} />
          ))}
        </div>
      </section>

      {item.addOns.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Add-ons</h2>
          <ul className={styles.dates}>
            {item.addOns.map((a) => (
              <li key={a.id}>{`${a.quantity} × ${a.name} · ${money(a.price)} ${PER_LABEL[a.per]}`}</li>
            ))}
          </ul>
        </section>
      )}

      <div className={order.panel}>
        <span className={order.faint}>{`Booking #${item.orderNo}`}</span>
        <span>{`${money(total)}${unpaid ? " to pay" : ""}${item.price.platformFee ? `, including a ${money(item.price.platformFee)} platform fee` : ""}`}</span>
        {item.price.discount > 0 && (
          <span className={order.small}>{`${money(item.price.discount)} off${item.coupon ? ` with ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "turf")}` : ""}`}</span>
        )}
        <span className={order.faint}>{`By ${item.business.name}`}</span>
      </div>

      <div className={events.factRow}>
        <Icon name="shield" size={18} />
        <span>{`${item.refundRule} ${GROUND_CANCELS}`}</span>
      </div>

      <InvoiceLinks refs={item.invoices} audience="customer" />

      {item.canCancel &&
        (confirming ? (
          <div className={order.news}>
            <strong>{unpaid ? "Cancel this booking?" : open.length > 1 ? "Cancel which dates?" : "Cancel this booking?"}</strong>
            <p className={order.small}>
              {unpaid
                ? "The slots go back for someone else."
                : picked.length === 0
                  ? "Tick the dates to cancel."
                  : refund > 0
                    ? `${money(refund)} goes back to how you paid. The slots go back for someone else.`
                    : "It’s too close to the start for a refund. The slots go back for someone else."}
            </p>
            <div className={order.actions}>
              <Button variant="danger" loading={cancelling} disabled={!unpaid && picked.length === 0} onClick={() => void cancel()}>
                {all ? "Cancel booking" : `Cancel ${picked.length} ${picked.length === 1 ? "date" : "dates"}`}
              </Button>
              <Button variant="ghost" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={startCancel}>
            {confirmed ? "Cancel and get a refund" : "Cancel"}
          </button>
        ))}
      {confirmed && !item.canCancel && item.occurrences.some((o) => o.status === "booked") && (
        <p className={order.faint}>Every date has started or passed, so it can’t be cancelled now.</p>
      )}
    </div>
  );
}

/** One turf booking: its dates, directions, paying, cancelling with the refund for each date, the invoice and the review. Same as the app. */
export function BookingScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [item, setItem] = useState<TurfBooking | null>(null);
  const [error, setError] = useState<unknown>(null);
  const waiting = item?.status === "awaiting_payment";

  const load = useCallback(
    () =>
      getBooking(id).then(
        (b) => {
          setItem(b);
          setError(null);
        },
        (err: unknown) => !onSignedOut(err) && setError(err),
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void load();
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [load]);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  if (item) return <BookingView item={item} fresh={fresh} onChanged={setItem} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Booking not found" : "Could not load this booking"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/bookings" variant="secondary">
            Your bookings
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
