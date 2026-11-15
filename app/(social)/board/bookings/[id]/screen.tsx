"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useActionKey, useDesk } from "@/components/turf/desk";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { deskBooking, deskCancel, markArrival, type DeskBooking, type Occurrence } from "@/lib/api/turf";
import { offerWord } from "@/lib/coupons";
import { BOOKING_STATUS, istParts, nextDate, PER_LABEL, weeksText, whenText, type TurfPermission } from "@/lib/turf";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/turf/turf.module.css";

const HOUR = 3_600_000;

function dateLine(o: Occurrence): string {
  if (o.status === "cancelled") {
    const by = o.cancelledBy === "customer" ? "Cancelled by the player" : o.cancelledBy === "ruxstar" ? "Cancelled by Ruxstar" : "Cancelled by the ground";
    return o.refund && o.refund.amount > 0 ? `${by} · ${money(o.refund.amount)} refunded` : by;
  }
  if (o.arrival === "arrived") return "Arrived";
  if (o.arrival === "no_show") return "Didn’t turn up";
  return money(o.paid);
}

function DateRow({
  item,
  o,
  can,
  picking,
  picked,
  onToggle,
  onChanged,
}: {
  item: DeskBooking;
  o: Occurrence;
  can: (p: TurfPermission) => boolean;
  picking: boolean;
  picked: boolean;
  onToggle: () => void;
  onChanged: (next: DeskBooking) => void;
}) {
  const [busy, setBusy] = useState<"arrived" | "no_show" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const now = Date.now();
  const start = Date.parse(o.startAt);
  const until = Date.parse(o.endAt) + 24 * HOUR;
  const booked = o.status === "booked" && item.status === "confirmed";
  const canArrive = booked && o.arrival !== "arrived" && now >= start - HOUR / 2 && now <= until;
  const canNoShow = booked && o.arrival !== "no_show" && now >= start && now <= until;

  const mark = async (status: "arrived" | "no_show") => {
    const body = { n: o.n, status };
    setBusy(status);
    setFailure(null);
    try {
      onChanged(await markArrival(item.id, body, key.keyFor(JSON.stringify(body))));
      key.settle();
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const text = (
    <span className={order.rowText}>
      <span className={o.status === "cancelled" ? `${order.rowTitle} ${styles.struck}` : order.rowTitle}>{whenText(o.startAt, o.endAt)}</span>
      <span className={order.faint}>{dateLine(o)}</span>
      {o.cancelReason && <span className={order.faint}>{o.cancelReason}</span>}
      {failure && (
        <span className={order.error} role="alert">
          {failure}
        </span>
      )}
    </span>
  );

  if (picking && o.canCancel) {
    return (
      <label className={`${order.row} ${styles.pickRow}`}>
        <input type="checkbox" checked={picked} onChange={onToggle} />
        {text}
        <span className={order.rowEnd}>{`${money(o.refundIfCancelled?.amount ?? o.paid)} back`}</span>
      </label>
    );
  }
  return (
    <div className={order.row}>
      <span className={order.rowIcon}>
        <Icon name={o.status === "cancelled" ? "close" : o.arrival === "arrived" ? "verified" : "calendar"} size={20} />
      </span>
      {text}
      {can("turf.arrivals") && (canArrive || canNoShow) && (
        <span className={order.actions}>
          {canArrive && (
            <Button variant="secondary" loading={busy === "arrived"} disabled={!!busy} onClick={() => void mark("arrived")}>
              Arrived
            </Button>
          )}
          {canNoShow && (
            <Button variant="ghost" loading={busy === "no_show"} disabled={!!busy} onClick={() => void mark("no_show")}>
              Didn’t turn up
            </Button>
          )}
        </span>
      )}
    </div>
  );
}

function BookingView({ item, onChanged, cancelFirst }: { item: DeskBooking; onChanged: (next: DeskBooking) => void; cancelFirst: boolean }) {
  const { ground, can } = useDesk(item.ground.id);
  const open = item.occurrences.filter((o) => o.canCancel);
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState<number[]>(() => open.map((o) => o.n));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useActionKey();
  const status = BOOKING_STATUS[item.status];
  const all = picked.length === open.length;
  const refund = open.filter((o) => picked.includes(o.n)).reduce((sum, o) => sum + (o.refundIfCancelled?.amount ?? o.paid), 0);
  const mayCancel = item.canCancel && item.status === "confirmed" && can("turf.cancel");

  useEffect(() => {
    if (cancelFirst && mayCancel) setConfirming(true);
  }, [cancelFirst, mayCancel]);

  const toggle = (n: number) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n].sort((a, b) => a - b)));

  const cancel = async () => {
    const body = all ? { reason: reason.trim() } : { occurrences: picked, reason: reason.trim() };
    setBusy(true);
    setFailure(null);
    try {
      onChanged(await deskCancel(item.id, body, key.keyFor(JSON.stringify(body))));
      key.settle();
      setConfirming(false);
      setReason("");
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={order.page}>
      <Back href={`/board/${item.ground.id}/bookings`}>Bookings</Back>
      <div className={order.titleRow}>
        <div>
          <h1 className={order.title}>{item.customer.name}</h1>
          <p className={order.small}>{`${item.ground.name} · ${[item.court.name, item.sport?.name].filter(Boolean).join(" · ")}`}</p>
          <p className={order.small}>{item.weeks > 1 ? `Weekly, ${weeksText(item.weeks)}` : whenText(item.firstAt, item.occurrences[0]!.endAt)}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {item.customer.phone && (
        <ButtonLink href={`tel:${item.customer.phone}`} variant="secondary" icon={<Icon name="phone" size={16} />}>
          {`Call ${item.customer.phone}`}
        </ButtonLink>
      )}
      {item.status === "awaiting_payment" && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>The slots are held while the player pays. They free up if the payment doesn’t come through.</p>
        </div>
      )}
      {item.status === "cancelled" && item.reason && <p className={order.small}>{item.reason}</p>}
      {item.refunds.map((r, i) => (
        <div key={i} className={order.news}>
          <p className={order.small}>{r.status === "done" ? `${money(r.amount)} refunded to the player.` : `Refunding ${money(r.amount)} to the player…`}</p>
        </div>
      ))}

      <section className={order.section}>
        <h2 className={order.overline}>{item.weeks > 1 ? `Dates · ${item.occurrences.length}` : "When"}</h2>
        <div className={order.rows}>
          {item.occurrences.map((o) => (
            <DateRow
              key={o.n}
              item={item}
              o={o}
              can={can}
              picking={confirming && open.length > 1}
              picked={picked.includes(o.n)}
              onToggle={() => toggle(o.n)}
              onChanged={onChanged}
            />
          ))}
        </div>
        {can("turf.arrivals") && <p className={order.faint}>Mark arrival from 30 minutes before a slot, and a no-show once it starts, up to a day after.</p>}
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
        <span>{`${money(item.price.total)} paid${item.price.platformFee ? `, including Ruxstar’s ${money(item.price.platformFee)} fee` : ""}`}</span>
        {item.price.discount > 0 && (
          <span className={order.small}>{`${money(item.price.discount)} off${item.coupon ? ` with ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "turf")}` : ""}`}</span>
        )}
        {ground?.owner && <span className={order.small}>{`Your share: ${money(item.vendorShare)}`}</span>}
      </div>
      <div className={events.factRow}>
        <Icon name="shield" size={18} />
        <span>{`Player’s rule: ${item.refundRule} If you cancel, they get everything back.`}</span>
      </div>

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      {mayCancel &&
        (confirming ? (
          <div className={order.news}>
            <strong>{open.length > 1 ? "Cancel which dates?" : "Cancel this booking?"}</strong>
            <p className={order.small}>
              {picked.length === 0 ? "Tick the dates to cancel." : `${money(refund)} goes back to the player, platform fee included. The slots open up for others.`}
            </p>
            <TextArea label="Tell the player why" value={reason} onChange={setReason} max={300} placeholder="Like “The pitch is flooded after the rain”" />
            <div className={order.actions}>
              <Button variant="danger" loading={busy} disabled={picked.length === 0 || reason.trim().length < 5} onClick={() => void cancel()}>
                {all ? "Cancel with full refund" : `Cancel ${picked.length} ${picked.length === 1 ? "date" : "dates"}`}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={() => setConfirming(true)}>
            Cancel with a full refund
          </button>
        ))}
      {item.canCancel && item.status === "confirmed" && ground && !can("turf.cancel") && <p className={order.faint}>You can’t cancel bookings here. Ask the owner to allow it.</p>}

      <Link className={order.small} href={`/board/${item.ground.id}?date=${istParts(nextDate(item).startAt).day}`}>
        See it on the board
      </Link>
    </div>
  );
}

/** One booking for the ground's owner and staff: the player, each date with arrival, add-ons, money and cancelling with a full refund. */
export function DeskBookingScreen({ id, cancel }: { id: string; cancel: boolean }) {
  const { data, error, reload, setData } = useLoad(() => deskBooking(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <BookingView item={data} onChanged={setData} cancelFirst={cancel} />;
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <Empty title="Booking not found">
          <p>It may be at a ground you don’t run.</p>
          <ButtonLink href="/board" variant="secondary">
            Grounds
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={4} />;
}
