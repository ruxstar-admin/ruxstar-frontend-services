"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { TextArea } from "@/components/vendor/parts";
import { PriceLine, Timeline } from "@/components/stays/pieces";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { cancelStay, getStay, giveNotice, objectStay, payStay, withdrawObjection, type StayReservation } from "@/lib/api/stays";
import { offerWord } from "@/lib/coupons";
import { bedsText, dayShort, depositLine, directionsUrl, momentText, plural, STAY_STATUS, stayText, stayTimeline, unitsText } from "@/lib/stays";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/stays/stays.module.css";

/** While it waits for payment, each look also asks Cashfree whether it was paid. */
const POLL_MS = 8000;

/** Its own chunk: only stays that can have a review download it. */
const Rate = dynamic(() => import("@/components/reviews/Reviews").then((m) => m.Rate));

type Busy = "pay" | "cancel" | "object" | "withdraw" | "notice" | null;
type Open = "cancel" | "object" | "notice" | null;

function cancelledLine(r: StayReservation): string {
  const c = r.cancellation;
  if (!c) return "Cancelled";
  const by = c.by === "property" ? "Cancelled by the property" : c.by === "ruxstar" ? "Cancelled by Ruxstar" : c.by === "system" ? "Not paid in time" : "You cancelled";
  return `${by} · ${momentText(c.at)}`;
}

function StayView({ item, fresh, onChanged }: { item: StayReservation; fresh: boolean; onChanged: (next: StayReservation) => void }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [open, setOpen] = useState<Open>(null);
  const [reason, setReason] = useState("");
  const [noticeDay, setNoticeDay] = useState(item.noticeFrom ?? "");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const keys = useRef<{ sig: string; key: string } | null>(null);
  const status = STAY_STATUS[item.status];
  const unpaid = item.status === "awaiting_payment";
  const cancelled = item.status === "cancelled";

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const keyFor = (sig: string) => {
    if (keys.current?.sig !== sig) keys.current = { sig, key: newIdempotencyKey() };
    return keys.current.key;
  };
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<StayReservation | void>, keyed = false) => {
    setBusy(kind);
    setError(null);
    try {
      const next = await action();
      if (next) onChanged(next);
      setOpen(null);
      setReason("");
      keys.current = null;
    } catch (err) {
      setError(formError(err).message);
      if (keyed && !(err instanceof ApiError && err.code === "NETWORK")) keys.current = null;
    } finally {
      setBusy(null);
    }
  };
  const toggle = (next: Open) => {
    setOpen((o) => (o === next ? null : next));
    setReason("");
    setError(null);
  };

  /** Stays busy on success: the page is leaving for Cashfree. */
  const pay = async () => {
    setBusy("pay");
    setError(null);
    try {
      const { checkoutUrl } = await payStay(item.id, `${window.location.origin}/reservations`);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(formError(err).message);
      setBusy(null);
    }
  };
  const cancel = () => run("cancel", () => cancelStay(item.id, reason.trim() || undefined, keyFor(`cancel|${reason.trim()}`)), true);
  const object = () => run("object", () => objectStay(item.id, reason.trim(), keyFor(`object|${reason.trim()}`)), true);
  const withdraw = () => run("withdraw", () => withdrawObjection(item.id));
  const notice = () => run("notice", () => giveNotice(item.id, noticeDay || undefined, keyFor(`notice|${noticeDay}`)), true);

  const reasonOk = reason.trim().length >= 5;
  const mayReview = item.movedInAt !== null || !!item.canReview;
  const back = item.refundIfCancelled ?? 0;

  return (
    <div className={order.page}>
      {fresh && item.status === "confirmed" && (
        <div className={events.wait} data-offered role="status">
          <strong>{`You’re in. Your ${item.whole || item.room.kind === "private" ? "room" : "bed"} is reserved.`}</strong>
          <p className={order.small}>{`The owner has your reservation. Move in on ${dayShort(item.moveIn)}; we’ll tell you if anything changes.`}</p>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            {item.property.removed ? (
              item.property.name
            ) : (
              <Link href={`/stays/${item.property.id}`} className={events.titleLink}>
                {item.property.name}
              </Link>
            )}
          </h1>
          <p className={order.small}>{bedsText(item)}</p>
          <p className={order.small}>{stayText(item)}</p>
          <p className={order.small}>{`${item.property.address}, ${item.property.city}`}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {item.property.removed && (
        <div className={order.news}>
          <strong>Taken down</strong>
          <p className={order.small}>Ruxstar took this place down. Reservations not moved in yet are cancelled and refunded in full.</p>
        </div>
      )}
      {cancelled && (
        <div className={order.news}>
          <strong>{cancelledLine(item)}</strong>
          {item.cancellation?.reason && <p className={order.small}>{item.cancellation.reason}</p>}
        </div>
      )}
      {item.refund && (
        <div className={order.news}>
          <p className={order.small}>
            {item.refund.status === "done"
              ? `${money(item.refund.amount)} refunded to how you paid. Banks take up to 7 days to show it.`
              : `Refunding ${money(item.refund.amount)}…`}
          </p>
        </div>
      )}

      {!cancelled && <Timeline steps={stayTimeline(item, now)} />}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      {unpaid && (
        <Button size="lg" loading={busy === "pay"} onClick={() => void pay()}>
          {`Pay ${money(item.price.total)}`}
        </Button>
      )}

      {item.objection && item.objection.status !== "withdrawn" && (
        <div className={order.news} role="status">
          <strong>{item.objection.status === "open" ? "You raised a problem" : "Your problem was looked into"}</strong>
          <p className={order.small}>{`“${item.objection.reason}” · ${momentText(item.objection.at)}`}</p>
          {item.objection.note && <p className={order.small}>{`Ruxstar: ${item.objection.note}`}</p>}
          {item.objection.status === "open" && (
            <div>
              <Button variant="ghost" loading={busy === "withdraw"} onClick={() => void withdraw()}>
                It’s sorted now, withdraw it
              </Button>
            </div>
          )}
        </div>
      )}

      {item.canObject &&
        (open === "object" ? (
          <div className={order.panel}>
            <strong>Something’s wrong?</strong>
            <p className={order.small}>
              Tell Ruxstar what isn’t right, for example the room isn’t what was shown or the bed was given to someone else. The owner isn’t paid while we look
              into it, and you can get a full refund.
            </p>
            <TextArea label="What’s wrong" value={reason} onChange={setReason} max={500} placeholder="What you found when you moved in" />
            <div className={order.actions}>
              <Button variant="danger" loading={busy === "object"} disabled={!reasonOk} onClick={() => void object()}>
                Tell Ruxstar
              </Button>
              <Button variant="ghost" disabled={busy === "object"} onClick={() => toggle(null)}>
                Not now
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" icon={<Icon name="flag" size={16} />} onClick={() => toggle("object")}>
            Something’s wrong
          </Button>
        ))}

      {!cancelled && item.status !== "moved_out" && (
        <a
          className={events.textLink}
          href={directionsUrl({ name: item.property.name, address: item.property.address, city: item.property.city, point: item.property.point })}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Maps
        </a>
      )}

      {mayReview && (
        <Rate
          orderId={item.id}
          module="stays"
          open={!!item.canReview}
          until={item.reviewUntil ?? null}
          words={{
            ask: "Rate this place",
            askLine: `How is it living here? Your review helps others choose ${item.property.name}.`,
            writeTitle: `Rate ${item.property.name}`,
            placeholder: "The room, the food, cleanliness, the owner or warden",
          }}
        />
      )}

      <div className={order.panel}>
        <span className={order.faint}>{`Reservation #${item.orderNo}`}</span>
        <dl className={order.prices}>
          <PriceLine label={`Rent, ${unitsText(item.stay, item.units)}`} amount={item.price.items} />
          {item.price.discount > 0 && (
            <PriceLine label={item.coupon ? `Coupon ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "stays")}` : "Discount"} amount={item.price.discount} minus />
          )}
          {item.price.platformFee > 0 && <PriceLine label="Platform fee" amount={item.price.platformFee} />}
          <PriceLine label={unpaid ? "To pay" : "Paid"} amount={item.price.total} strong />
        </dl>
        <span className={order.small}>{depositLine(item.deposit)}</span>
        {item.stay === "month" && <span className={order.faint}>Rent after the months paid here goes to the owner directly.</span>}
        <span className={order.faint}>{`By ${item.business.name}`}</span>
      </div>

      <div className={events.factRow}>
        <Icon name="shield" size={18} />
        <span>{item.refundRule}</span>
      </div>

      <InvoiceLinks refs={item.invoices} audience="customer" />

      {item.moveOut && item.status !== "moved_out" && (
        <p className={order.small}>{`${item.moveOut.kind === "notice" ? "Notice given" : "Move-out set"}: last day ${dayShort(item.moveOut.on)}.`}</p>
      )}

      {item.canGiveNotice &&
        (open === "notice" ? (
          <div className={order.panel}>
            <strong>Give notice</strong>
            <p className={order.small}>
              {`This place needs ${plural(item.noticeDays, "day")}’ notice. Pick the day you move out; the bed is free for someone else from that day.`}
            </p>
            <label className={styles.field}>
              Moving-out day
              <input type="date" value={noticeDay} min={item.noticeFrom ?? undefined} onChange={(e) => setNoticeDay(e.target.value)} />
            </label>
            <div className={order.actions}>
              <Button loading={busy === "notice"} disabled={!noticeDay || (!!item.noticeFrom && noticeDay < item.noticeFrom)} onClick={() => void notice()}>
                {noticeDay ? `Move out on ${dayShort(noticeDay)}` : "Pick a day"}
              </Button>
              <Button variant="ghost" disabled={busy === "notice"} onClick={() => toggle(null)}>
                Not now
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} onClick={() => toggle("notice")}>
            Give notice to move out
          </button>
        ))}

      {item.canCancel &&
        (open === "cancel" ? (
          <div className={order.news}>
            <strong>Cancel this reservation?</strong>
            <p className={order.small}>
              {unpaid
                ? "The bed goes back for someone else."
                : back > 0
                  ? `${money(back)} goes back to how you paid. The bed goes back for someone else.`
                  : "It’s too close to move-in for a refund. The bed goes back for someone else."}
            </p>
            {!unpaid && <TextArea label="Why? (optional)" value={reason} onChange={setReason} max={300} />}
            <div className={order.actions}>
              <Button variant="danger" loading={busy === "cancel"} disabled={reason.trim().length > 0 && reason.trim().length < 2} onClick={() => void cancel()}>
                Cancel reservation
              </Button>
              <Button variant="ghost" disabled={busy === "cancel"} onClick={() => toggle(null)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={() => toggle("cancel")}>
            {item.status === "confirmed" ? (back > 0 ? "Cancel and get a refund" : "Cancel") : "Cancel"}
          </button>
        ))}
    </div>
  );
}

/** One PG or hostel reservation: where it is on the way to moving in, the window to raise a problem, notice, cancelling, the invoice and the review. */
export function StayScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [item, setItem] = useState<StayReservation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const waiting = item?.status === "awaiting_payment";

  const load = useCallback(
    () =>
      getStay(id).then(
        (r) => {
          setItem(r);
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

  if (item) return <StayView item={item} fresh={fresh} onChanged={setItem} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Reservation not found" : "Could not load this reservation"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/reservations" variant="secondary">
            Your stays
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
