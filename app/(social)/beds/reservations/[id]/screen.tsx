"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useActionKey, useStaysDesk } from "@/components/stays/desk";
import { Timeline } from "@/components/stays/pieces";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { deskCancel, deskReservation, markMovedIn, markMoveOut, type DeskReservation } from "@/lib/api/stays";
import { offerWord } from "@/lib/coupons";
import { bedsText, dayShort, depositLine, istToday, momentText, PAYOUT_LABEL, STAY_STATUS, stayText, stayTimeline } from "@/lib/stays";
import order from "@/components/shop/order.module.css";
import events from "@/components/events/events.module.css";
import styles from "@/components/stays/stays.module.css";

type Busy = "in" | "out" | "cancel" | null;
type Open = "out" | "cancel" | null;

const CANCELLED_BY = { customer: "Cancelled by the tenant", property: "Cancelled by you", ruxstar: "Cancelled by Ruxstar", system: "Not paid in time" } as const;

function ReservationView({ item, onChanged }: { item: DeskReservation; onChanged: (next: DeskReservation) => void }) {
  const { property, can } = useStaysDesk(item.property.id);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [outDay, setOutDay] = useState(() => istToday());
  const [outReason, setOutReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const key = useActionKey();
  const status = STAY_STATUS[item.status];
  const cancelled = item.status === "cancelled";
  const today = istToday();
  const now = Date.now();

  const run = async (what: Exclude<Busy, null>, sig: string, act: (k: string) => Promise<DeskReservation>) => {
    setBusy(what);
    setFailure(null);
    try {
      onChanged(await act(key.keyFor(sig)));
      key.settle();
      setOpen(null);
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };
  const movedIn = () => run("in", `in:${item.id}`, (k) => markMovedIn(item.id, k));
  const moveOut = () => {
    const body = { ...(outDay !== today ? { on: outDay } : {}), ...(outReason.trim() ? { reason: outReason.trim() } : {}) };
    return run("out", `out:${item.id}:${JSON.stringify(body)}`, (k) => markMoveOut(item.id, body, k));
  };
  const cancel = () => run("cancel", `cancel:${item.id}:${cancelReason.trim()}`, (k) => deskCancel(item.id, cancelReason.trim(), k));

  return (
    <div className={order.page}>
      <Back href={`/beds/${item.property.id}/reservations`}>Reservations</Back>
      <div className={order.titleRow}>
        <div>
          <h1 className={order.title}>{item.tenant.name}</h1>
          <p className={order.small}>{`${item.property.name} · ${bedsText(item)}`}</p>
          <p className={order.small}>{stayText(item)}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      {item.tenant.verified && (
        <p className={order.small}>
          <Icon name="verified" size={14} /> KYC verified by Ruxstar
        </p>
      )}

      {item.tenant.phone && (
        <ButtonLink href={`tel:${item.tenant.phone}`} variant="secondary" icon={<Icon name="phone" size={16} />}>
          {`Call ${item.tenant.phone}`}
        </ButtonLink>
      )}
      {item.status === "awaiting_payment" && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>The bed is held while the tenant pays. It frees up if the payment doesn’t come through.</p>
        </div>
      )}
      {item.cancellation && (
        <div className={order.news}>
          <strong>{CANCELLED_BY[item.cancellation.by]}</strong>
          {item.cancellation.reason && <p className={order.small}>{item.cancellation.reason}</p>}
        </div>
      )}
      {item.refund && item.refund.amount > 0 && (
        <p className={order.small}>{item.refund.status === "done" ? `${money(item.refund.amount)} refunded to the tenant.` : `Refunding ${money(item.refund.amount)} to the tenant…`}</p>
      )}

      {!cancelled && <Timeline steps={stayTimeline(item, now, true)} />}

      {item.objection && (
        <div className={order.news}>
          <strong>{item.objection.status === "open" ? "The tenant raised a problem" : item.objection.status === "withdrawn" ? "The tenant took their problem back" : "Problem looked into by Ruxstar"}</strong>
          <p className={order.small}>{`“${item.objection.reason}” · ${momentText(item.objection.at)}`}</p>
          {item.objection.note && <p className={order.small}>{`Ruxstar: ${item.objection.note}`}</p>}
          {item.objection.status === "open" && <p className={order.faint}>Your payout for this stay waits until Ruxstar decides. You can reply through Ruxstar support.</p>}
        </div>
      )}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      {item.canMoveIn && can("stays.movein") && (
        <div className={order.panel}>
          <strong>Has the tenant moved in?</strong>
          <p className={order.small}>Tap once they’ve arrived. They then have a short window to tell Ruxstar if something’s wrong, and you’re paid after it.</p>
          <div className={order.actions}>
            <Button icon={<Icon name="check" size={16} />} loading={busy === "in"} disabled={!!busy} onClick={() => void movedIn()}>
              Moved in
            </Button>
          </div>
        </div>
      )}
      {!item.canMoveIn && !item.movedInAt && item.status === "confirmed" && can("stays.movein") && item.moveIn > today && (
        <p className={order.faint}>{`You can mark them moved in from ${dayShort(item.moveIn)}.`}</p>
      )}

      {item.canMoveOut &&
        can("stays.movein") &&
        (open === "out" ? (
          <div className={order.panel}>
            <strong>Mark a move-out</strong>
            <p className={order.small}>The bed is free for new reservations from the moving-out day.</p>
            <label className={styles.field}>
              Moving-out day
              <input type="date" value={outDay} min={today} onChange={(e) => setOutDay(e.target.value)} />
            </label>
            <TextArea label="Note (optional)" value={outReason} onChange={setOutReason} max={300} placeholder="Like “Moving to another city”" />
            <div className={order.actions}>
              <Button loading={busy === "out"} disabled={!!busy || !outDay || outDay < today} onClick={() => void moveOut()}>
                {outDay === today ? "Moving out today" : `Moving out ${dayShort(outDay)}`}
              </Button>
              <Button variant="ghost" disabled={!!busy} onClick={() => setOpen(null)}>
                Not now
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" disabled={!!busy} onClick={() => setOpen("out")}>
            {item.moveOut ? "Change the move-out day" : "Mark a move-out"}
          </Button>
        ))}

      <div className={order.panel}>
        <span className={order.faint}>{`Reservation #${item.orderNo}`}</span>
        <span>{`${money(item.price.total)} paid${item.price.platformFee ? `, including Ruxstar’s ${money(item.price.platformFee)} fee` : ""}`}</span>
        {item.price.discount > 0 && (
          <span className={order.small}>{`${money(item.price.discount)} off${item.coupon ? ` with ${item.coupon.code} · ${offerWord(item.coupon.fundedBy, "stays")}` : ""}`}</span>
        )}
        {property?.owner && (
          <>
            <span className={order.small}>{`Your share: ${money(item.vendorShare)}`}</span>
            <span className={order.small}>{item.payout === "waiting" && item.releaseAt ? `Paid out after ${momentText(item.releaseAt)}` : PAYOUT_LABEL[item.payout]}</span>
          </>
        )}
      </div>
      <div className={events.factRow}>
        <Icon name="wallet" size={18} />
        <span>{depositLine(item.deposit)}</span>
      </div>
      <div className={events.factRow}>
        <Icon name="shield" size={18} />
        <span>{`Tenant’s rule: ${item.refundRule} If you cancel, they get everything back.`}</span>
      </div>

      {item.canCancel &&
        can("stays.cancel") &&
        (open === "cancel" ? (
          <div className={order.news}>
            <strong>Cancel this reservation?</strong>
            <p className={order.small}>{`${money(item.price.total)} goes back to the tenant, platform fee included. The bed opens up for others.`}</p>
            <TextArea label="Tell the tenant why" value={cancelReason} onChange={setCancelReason} max={300} placeholder="Like “The room needs repairs”" />
            <div className={order.actions}>
              <Button variant="danger" loading={busy === "cancel"} disabled={!!busy || cancelReason.trim().length < 5} onClick={() => void cancel()}>
                Cancel with full refund
              </Button>
              <Button variant="ghost" disabled={!!busy} onClick={() => setOpen(null)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className={events.textLink} data-danger onClick={() => setOpen("cancel")}>
            Cancel with a full refund
          </button>
        ))}
      {item.canCancel && property && !can("stays.cancel") && <p className={order.faint}>You can’t cancel reservations here. Ask the owner to allow it.</p>}

      <Link className={order.small} href={`/beds/${item.property.id}?from=${item.moveIn < today ? today : item.moveIn}`}>
        See it on the bed map
      </Link>
    </div>
  );
}

/** One reservation for the property's owner and wardens: the tenant, moving in and out, money, and cancelling with a full refund. */
export function DeskReservationScreen({ id }: { id: string }) {
  const { data, error, reload, setData } = useLoad(() => deskReservation(id), id);

  useEffect(() => {
    const onShow = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [reload]);

  if (data) return <ReservationView item={data} onChanged={setData} />;
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <Empty title="Reservation not found">
          <p>It may be at a property you don’t run.</p>
          <ButtonLink href="/beds" variant="secondary">
            Properties
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={4} />;
}
