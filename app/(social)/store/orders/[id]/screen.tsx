"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { InvoiceLinks } from "@/components/invoices/InvoiceLinks";
import { Back, Failed, Loading, TextArea } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { useActionKey } from "@/components/stays/desk";
import { Timeline } from "@/components/stays/pieces";
import { useStoreDesk } from "@/components/store/desk";
import { OrderLines, OrderPrice, ReturnCard } from "@/components/store/OrderPieces";
import { StoreDelivery } from "@/components/store/StoreDelivery";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { money } from "@/lib/api/shops";
import { cancelDeskOrder, decideDeskReturn, deskOrder, moveDeskOrder, receivedDeskReturn, type DeskOrder, type MoveTo } from "@/lib/api/store";
import { cancelledLine, DESK_STATUS, isMove, itemsText, momentText, moveAction, orderTimeline, PAYOUT_LABEL } from "@/lib/store";
import order from "@/components/shop/order.module.css";

/** While a rider has it, the trip's status changes without anyone here doing anything. */
const POLL_MS = 15_000;

type Busy = MoveTo | "cancel" | "approve" | "reject" | "received" | null;
type Open = "cancel" | "reject" | null;

function OrderView({ o, onChanged }: { o: DeskOrder; onChanged: (next: DeskOrder) => void }) {
  const { store, can } = useStoreDesk(o.business.id);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [text, setText] = useState("");
  const key = useActionKey();
  const status = DESK_STATUS[o.status];
  const cancelled = o.status === "cancelled";
  const moves = o.next.filter(isMove);
  const ret = o.return;

  const run = async (what: Exclude<Busy, null>, sig: string, act: (k: string) => Promise<DeskOrder>) => {
    setBusy(what);
    setFailure(null);
    try {
      onChanged(await act(key.keyFor(sig)));
      key.settle();
      setOpen(null);
      setText("");
    } catch (err) {
      key.settle(err);
      setFailure(formError(err).message);
    } finally {
      setBusy(null);
    }
  };
  const move = (to: MoveTo) => run(to, `move:${o.id}:${to}`, (k) => moveDeskOrder(o.id, to, k));
  const cancel = () => run("cancel", `cancel:${o.id}:${text.trim()}`, (k) => cancelDeskOrder(o.id, text.trim(), k));
  const approve = () => run("approve", `approve:${o.id}`, (k) => decideDeskReturn(o.id, { decision: "approve" }, k));
  const reject = () => run("reject", `reject:${o.id}:${text.trim()}`, (k) => decideDeskReturn(o.id, { decision: "reject", note: text.trim() }, k));
  const received = () => run("received", `received:${o.id}`, (k) => receivedDeskReturn(o.id, undefined, k));
  const toggle = (next: Open) => {
    setOpen((v) => (v === next ? null : next));
    setText("");
    setFailure(null);
  };

  return (
    <div className={order.page}>
      <Back href={`/store/${o.business.id}`}>Orders</Back>
      <div className={order.titleRow}>
        <div>
          <h1 className={order.title}>{`#${o.orderNo} · ${o.customer.name}`}</h1>
          <p className={order.small}>{`${itemsText(o.lines)} · ${o.method === "pickup" ? "Pickup" : "Delivery"} · ${money(o.price.total)}`}</p>
          <p className={order.faint}>{`Ordered ${momentText(o.createdAt)}`}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>

      {o.customer.phone && (
        <ButtonLink href={`tel:${o.customer.phone}`} variant="secondary" icon={<Icon name="phone" size={16} />}>
          {`Call ${o.customer.phone}`}
        </ButtonLink>
      )}

      {o.status === "awaiting_payment" && (
        <div className={order.news}>
          <strong>Not paid yet</strong>
          <p className={order.small}>Nothing to do until the customer pays. Stock is only taken once they do.</p>
        </div>
      )}
      {cancelled && (
        <div className={order.news}>
          <strong>{cancelledLine(o, true)}</strong>
          {o.cancellation?.reason && <p className={order.small}>{o.cancellation.reason}</p>}
        </div>
      )}

      {!cancelled && o.status !== "awaiting_payment" && <Timeline steps={orderTimeline(o, true)} />}

      {failure && (
        <p className={order.error} role="alert">
          {failure}
        </p>
      )}

      {moves.length > 0 && can("store.move") && (
        <div className={order.actions}>
          {moves.map((to, i) => (
            <Button key={to} size="lg" variant={i === 0 ? "primary" : "secondary"} loading={busy === to} disabled={!!busy} onClick={() => void move(to)}>
              {moveAction(to, o.method)}
            </Button>
          ))}
        </div>
      )}
      {o.status === "paid" && o.acceptBy && <p className={order.small}>{`Accept by ${momentText(o.acceptBy)}, or the customer is refunded.`}</p>}

      <StoreDelivery order={o} canManage={can("store.move")} onChanged={onChanged} />

      {ret && <ReturnCard ret={ret} lines={o.lines} forShop />}
      {ret?.status === "requested" && can("store.returns") && (
        <div className={order.panel}>
          <strong>Take it back?</strong>
          <p className={order.small}>
            {ret.tripPaidBy === "shop"
              ? "The customer says it was wrong or damaged, so your shop pays for the trip back."
              : "The customer pays for the trip back; it comes off their refund."}
          </p>
          {open === "reject" ? (
            <>
              <TextArea label="Why not? The customer is told" value={text} onChange={setText} max={500} />
              <div className={order.actions}>
                <Button variant="danger" loading={busy === "reject"} disabled={text.trim().length < 5} onClick={() => void reject()}>
                  Turn down the return
                </Button>
                <Button variant="ghost" disabled={busy === "reject"} onClick={() => toggle(null)}>
                  Not now
                </Button>
              </div>
            </>
          ) : (
            <div className={order.actions}>
              <Button loading={busy === "approve"} disabled={!!busy} onClick={() => void approve()}>
                Accept the return
              </Button>
              <Button variant="secondary" disabled={!!busy} onClick={() => toggle("reject")}>
                Turn it down
              </Button>
            </div>
          )}
        </div>
      )}
      {ret?.status === "approved" && !ret.receivedAt && can("store.returns") && (
        <div className={order.panel}>
          <strong>Got it back?</strong>
          <p className={order.small}>{`Once it’s back at the shop, ${money(ret.amount)} is refunded to the customer.`}</p>
          <div className={order.actions}>
            <Button loading={busy === "received"} onClick={() => void received()}>
              Mark received and refund
            </Button>
          </div>
        </div>
      )}

      {o.address && (
        <div className={order.panel}>
          <span className={order.overline}>Deliver to</span>
          <p className={order.small}>{`${o.address.name} · ${o.address.phone}`}</p>
          <p className={order.small}>{`${o.address.line}, ${o.address.city} ${o.address.pincode}`}</p>
        </div>
      )}
      {o.note && (
        <div className={order.news}>
          <strong>Note from the customer</strong>
          <p className={order.small}>{o.note}</p>
        </div>
      )}

      <section className={order.section}>
        <h2 className={order.overline}>Items</h2>
        <OrderLines lines={o.lines} showSku />
      </section>

      <OrderPrice
        o={o}
        after={
          <>
            <dl className={order.prices}>
              <div className={order.priceRow}>
                <dt>Ruxstar commission</dt>
                <dd>{`− ${money(o.commission)}`}</dd>
              </div>
              <div className={`${order.priceRow} ${order.total}`}>
                <dt>Your share</dt>
                <dd>{money(o.vendorShare)}</dd>
              </div>
            </dl>
            <span className={order.small}>{`${PAYOUT_LABEL[o.payout]}${o.releaseAt && o.payout === "waiting" ? ` · from ${momentText(o.releaseAt)}` : ""}`}</span>
          </>
        }
      />

      {store?.owner && <InvoiceLinks refs={o.invoices} audience="vendor" />}

      {o.canCancel &&
        can("store.cancel") &&
        (open === "cancel" ? (
          <div className={order.news}>
            <strong>Cancel this order?</strong>
            <p className={order.small}>{`The customer gets ${money(o.price.total)} back and the stock goes back on sale.`}</p>
            <TextArea label="Why? The customer is told" value={text} onChange={setText} max={300} placeholder="For example: out of stock, can’t deliver there" />
            <div className={order.actions}>
              <Button variant="danger" loading={busy === "cancel"} disabled={text.trim().length < 5} onClick={() => void cancel()}>
                Cancel and refund
              </Button>
              <Button variant="ghost" disabled={busy === "cancel"} onClick={() => toggle(null)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => toggle("cancel")}>
            Cancel order
          </Button>
        ))}
    </div>
  );
}

/** One order at a local shop for its owner and team: accept, pack, send or hand over, returns and cancelling. */
export function DeskOrderScreen({ id }: { id: string }) {
  const { data, error, reload, setData } = useLoad(() => deskOrder(id), id);
  const riding = !!data?.delivery && (data.delivery.status === "offered" || data.delivery.status === "accepted" || data.delivery.status === "picked_up");

  useEffect(() => {
    if (!riding) return;
    const timer = setInterval(() => document.visibilityState === "visible" && reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [riding, reload]);

  if (data) return <OrderView o={data} onChanged={setData} />;
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return (
        <Empty title="Order not found">
          <p>{error.status === 403 ? error.message : "It may be at a shop you don’t run."}</p>
          <ButtonLink href="/store" variant="secondary">
            Shops
          </ButtonLink>
        </Empty>
      );
    }
    return <Failed error={error} onRetry={reload} />;
  }
  return <Loading rows={5} />;
}
