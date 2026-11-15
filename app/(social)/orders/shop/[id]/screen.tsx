"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { RiderCard } from "@/components/shop/OrderParts";
import { Stepper, Timeline } from "@/components/stays/pieces";
import { TextArea } from "@/components/vendor/parts";
import { OrderLines, OrderPrice, RefundLines, ReturnCard } from "@/components/store/OrderPieces";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { cancelStoreOrder, getStoreOrder, payStoreOrder, returnStoreOrder, type ReturnReason, type StoreOrder } from "@/lib/api/store";
import {
  cancelledLine,
  directionsUrl,
  itemsText,
  leftText,
  momentText,
  optionsText,
  orderTimeline,
  RETURN_REASON,
  RETURN_REASONS,
  shopPaysTrip,
  STATUS,
} from "@/lib/store";
import shop from "@/components/shop/shop.module.css";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/store/store.module.css";

/** While it waits for payment, each look also asks Cashfree whether it was paid. While it's on its way, the rider's status. */
const POLL_MS = 8000;

/** Its own chunk: only delivered orders download it. */
const Rate = dynamic(() => import("@/components/reviews/Reviews").then((m) => m.Rate));

type Busy = "pay" | "cancel" | "return" | null;
type Open = "cancel" | "return" | null;

/** What the customer would get back, worked out the way the backend does: the items' share of the offer off, and the trip back when they pay it. */
function refundPreview(o: StoreOrder, picked: Map<string, number>, reason: ReturnReason) {
  const value = o.lines.reduce((s, l) => s + l.unitPrice * (picked.get(l.id) ?? 0), 0);
  const discount = o.price.items ? Math.round((o.price.discount * value) / o.price.items) : 0;
  const trip = !shopPaysTrip(reason) && o.method === "delivery" ? Math.min(o.price.delivery, value - discount) : 0;
  return { value, trip, amount: value - discount - trip };
}

function ReturnForm({ o, busy, onSend, onClose }: { o: StoreOrder; busy: boolean; onSend: (reason: ReturnReason, note: string, picked: Map<string, number>) => void; onClose: () => void }) {
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(() => new Map(o.lines.map((l) => [l.id, l.quantity])));
  const count = [...picked.values()].reduce((s, n) => s + n, 0);
  const preview = reason ? refundPreview(o, picked, reason) : null;

  return (
    <div className={order.panel}>
      <strong>Return items</strong>
      <p className={order.small}>{o.returnUntil ? `You can ask until ${momentText(o.returnUntil)} (${leftText(o.returnUntil)}).` : o.returnRule}</p>

      <fieldset className={styles.picker}>
        <legend className={order.label}>Why are you returning it?</legend>
        <div className={styles.values}>
          {RETURN_REASONS.map((r) => (
            <button key={r} type="button" className={styles.value} aria-pressed={reason === r} onClick={() => setReason(r)}>
              {RETURN_REASON[r]}
            </button>
          ))}
        </div>
      </fieldset>
      {reason && (
        <p className={order.small}>
          {shopPaysTrip(reason)
            ? "The shop got it wrong, so the shop pays for the trip back."
            : o.method === "delivery"
              ? `You pay for the trip back: ${money(o.price.delivery)} comes off the refund.`
              : "Bring it back to the shop; nothing comes off the refund."}
        </p>
      )}

      {o.lines.length > 1 || o.lines[0]!.quantity > 1 ? (
        <ul className={styles.stockList}>
          {o.lines.map((l) => (
            <li key={l.id} className={styles.stockRow}>
              <span className={styles.lineText}>
                <strong>{l.title}</strong>
                {l.options.length > 0 && <span className={order.small}>{optionsText(l.options)}</span>}
              </span>
              <Stepper
                value={picked.get(l.id) ?? 0}
                min={0}
                max={l.quantity}
                onChange={(n) => setPicked((now) => new Map(now).set(l.id, n))}
                label={`of ${l.title} to return`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <TextArea label="Anything to add? (optional)" value={note} onChange={setNote} max={500} placeholder="What’s wrong with it, or when to collect" />
      {preview && count > 0 && <p className={order.small}>{`You’d get back ${money(preview.amount)} once the shop has it.`}</p>}
      <div className={order.actions}>
        <Button loading={busy} disabled={!reason || count === 0} onClick={() => reason && onSend(reason, note.trim(), picked)}>
          {count > 0 ? `Return ${itemsText([{ quantity: count }])}` : "Pick what to return"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}

function OrderView({ o, fresh, onChanged }: { o: StoreOrder; fresh: boolean; onChanged: (next: StoreOrder) => void }) {
  const [busy, setBusy] = useState<Busy>(null);
  const [open, setOpen] = useState<Open>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const keys = useRef<{ sig: string; key: string } | null>(null);
  const status = STATUS[o.status];
  const unpaid = o.status === "awaiting_payment";
  const cancelled = o.status === "cancelled";
  const pickup = o.method === "pickup";

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const keyFor = (sig: string) => {
    if (keys.current?.sig !== sig) keys.current = { sig, key: newIdempotencyKey() };
    return keys.current.key;
  };
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<StoreOrder | void>, keyed = false) => {
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
    setOpen((v) => (v === next ? null : next));
    setReason("");
    setError(null);
  };

  const pay = () =>
    run("pay", async () => {
      const { checkoutUrl } = await payStoreOrder(o.id, `${window.location.origin}/orders/shop`);
      window.location.assign(checkoutUrl);
    });
  const cancel = () => run("cancel", () => cancelStoreOrder(o.id, reason.trim() || undefined, keyFor(`cancel|${reason.trim()}`)), true);
  const sendReturn = (why: ReturnReason, note: string, picked: Map<string, number>) => {
    const everything = o.lines.every((l) => picked.get(l.id) === l.quantity);
    const lines = everything ? undefined : o.lines.filter((l) => (picked.get(l.id) ?? 0) > 0).map((l) => ({ lineId: l.id, quantity: picked.get(l.id)! }));
    const body = { reason: why, ...(note ? { note } : {}), ...(lines ? { lines } : {}) };
    void run("return", () => returnStoreOrder(o.id, body, keyFor(`return|${JSON.stringify(body)}`)), true);
  };

  const pickupAt = o.pickupAt;
  const reviewable = o.status === "delivered" ? o.reviewable : [];

  return (
    <div className={order.page}>
      {fresh && (o.status === "paid" || o.status === "accepted") && (
        <div className={events.wait} data-offered role="status">
          <strong>Order placed</strong>
          <p className={order.small}>
            {o.acceptBy ? `${o.business.name} has until ${momentText(o.acceptBy)} to accept it, or you get everything back.` : `${o.business.name} has your order.`}
          </p>
        </div>
      )}

      <div className={order.titleRow}>
        <div className={shop.head}>
          <h1 className={order.title}>
            <Link href={`/shops/${o.business.id}`} className={events.titleLink}>
              {o.business.name}
            </Link>
          </h1>
          <p className={order.small}>{`#${o.orderNo} · ${itemsText(o.lines)} · ${pickup ? "Pickup" : "Delivery"}`}</p>
          <p className={order.faint}>{`Ordered ${momentText(o.createdAt)}`}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {cancelled && (
        <div className={order.news}>
          <strong>{cancelledLine(o)}</strong>
          {o.cancellation?.reason && <p className={order.small}>{o.cancellation.reason}</p>}
        </div>
      )}
      <RefundLines refunds={o.refunds} />

      {!cancelled && !unpaid && <Timeline steps={orderTimeline(o, false, now)} />}

      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      {unpaid && (
        <div className={order.actions}>
          <Button size="lg" loading={busy === "pay"} onClick={() => void pay()}>
            {`Pay ${money(o.price.total)}`}
          </Button>
          {o.payBy && <span className={order.faint}>{`Pay by ${momentText(o.payBy)}, or the order is cancelled.`}</span>}
        </div>
      )}

      {o.delivery && !cancelled && <RiderCard delivery={o.delivery} code={o.delivery.dropCode} note={o.delivery.carrier === "team" ? "Someone from the shop is bringing it." : undefined} />}

      {pickup && pickupAt && !cancelled && o.status !== "delivered" && (
        <div className={order.panel}>
          <strong>{o.status === "ready_for_pickup" ? "Ready to collect" : "Collect from"}</strong>
          <p className={order.small}>{`${o.business.name}, ${pickupAt.address}`}</p>
          <p className={order.faint}>{`Show order #${o.orderNo} at the counter.`}</p>
          <div className={order.actions}>
            <a className={events.textLink} href={directionsUrl({ name: o.business.name, address: pickupAt.address, point: pickupAt.point })} target="_blank" rel="noreferrer">
              Directions
            </a>
            {pickupAt.phone && (
              <a className={events.textLink} href={`tel:${pickupAt.phone}`}>
                Call the shop
              </a>
            )}
          </div>
        </div>
      )}

      {o.address && (
        <div className={order.panel}>
          <span className={order.overline}>Delivering to</span>
          <p className={order.small}>{`${o.address.name} · ${o.address.phone}`}</p>
          <p className={order.small}>{`${o.address.line}, ${o.address.city} ${o.address.pincode}`}</p>
        </div>
      )}

      {o.return && <ReturnCard ret={o.return} lines={o.lines} />}

      {o.canReturn &&
        (open === "return" ? (
          <ReturnForm o={o} busy={busy === "return"} onSend={sendReturn} onClose={() => toggle(null)} />
        ) : (
          <Button variant="secondary" icon={<Icon name="return" size={16} />} onClick={() => toggle("return")}>
            {o.returnUntil ? `Return items · ${leftText(o.returnUntil, now)}` : "Return items"}
          </Button>
        ))}

      <section className={order.section}>
        <h2 className={order.overline}>Items</h2>
        <OrderLines lines={o.lines} />
      </section>

      {reviewable.length > 0 && (
        <section className={order.section}>
          <h2 className={order.overline}>Rate what you bought</h2>
          {reviewable.map((p) => (
            <Rate
              key={p.productId}
              orderId={o.id}
              module="shop"
              productId={p.productId}
              open={p.canReview}
              until={p.reviewUntil}
              words={{
                ask: `Rate ${p.title}`,
                askLine: "How is it? Your review helps others choose.",
                writeTitle: `Rate ${p.title}`,
                placeholder: "The quality, the fit or size, how it was packed",
              }}
            />
          ))}
        </section>
      )}

      <OrderPrice o={o} />
      {o.note && <p className={order.small}>{`Your note: “${o.note}”`}</p>}

      <div className={events.factRow}>
        <Icon name="return" size={18} />
        <span>{o.returnRule}</span>
      </div>

      <InvoiceLinks refs={o.invoices} audience="customer" />

      {o.canCancel &&
        (open === "cancel" ? (
          <div className={order.news}>
            <strong>Cancel this order?</strong>
            <p className={order.small}>{unpaid ? "Nothing has been paid." : `${money(o.price.total)} goes back to how you paid.`}</p>
            {!unpaid && <TextArea label="Why? (optional)" value={reason} onChange={setReason} max={300} />}
            <div className={order.actions}>
              <Button variant="danger" loading={busy === "cancel"} disabled={reason.trim().length > 0 && reason.trim().length < 2} onClick={() => void cancel()}>
                Cancel order
              </Button>
              <Button variant="ghost" disabled={busy === "cancel"} onClick={() => toggle(null)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={() => toggle("cancel")}>
            {unpaid ? "Cancel" : "Cancel and get a refund"}
          </button>
        ))}
    </div>
  );
}

/** One local shop order: where it is, the rider or pickup, cancelling before it's packed, returns, the invoice and reviews. */
export function StoreOrderScreen({ id, fresh }: { id: string; fresh: boolean }) {
  const onSignedOut = useOnSignedOut();
  const [o, setO] = useState<StoreOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const moving = o?.status === "awaiting_payment" || o?.status === "out_for_delivery" || (!!o?.delivery && o.status === "packed");

  const load = useCallback(
    () =>
      getStoreOrder(id).then(
        (next) => {
          setO(next);
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
    if (!moving) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [moving, load]);

  if (o) return <OrderView o={o} fresh={fresh} onChanged={setO} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/orders?tab=shops" variant="secondary">
            Your orders
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
