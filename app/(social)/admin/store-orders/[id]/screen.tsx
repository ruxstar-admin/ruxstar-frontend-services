"use client";

import { useEffect, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { useActionKey } from "@/components/stays/desk";
import { Timeline } from "@/components/stays/pieces";
import { OrderLines, OrderPrice, ReturnCard } from "@/components/store/OrderPieces";
import { TextArea } from "@/components/vendor/parts";
import { Button, ButtonLink, Card, Icon, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { money } from "@/lib/api/shops";
import { consoleCancelOrder, consoleDecideReturn, consoleOrder, type ConsoleOrder } from "@/lib/api/store";
import { cancelledLine, DESK_STATUS, itemsText, momentText, orderTimeline, PAYOUT_LABEL } from "@/lib/store";
import order from "@/components/shop/order.module.css";

type Action = "cancel" | "approve" | "reject" | "refund";

const ACTION: Record<Action, { label: string; prompt: (o: ConsoleOrder) => string; placeholder: string; danger?: boolean }> = {
  cancel: {
    label: "Cancel and refund",
    prompt: (o) => `Cancel #${o.orderNo}? The customer gets ${money(o.price.total)} back, the stock goes back on sale and a rider’s trip is stopped. Both sides read your reason.`,
    placeholder: "For example: the shop can’t be reached.",
    danger: true,
  },
  approve: {
    label: "Accept the return",
    prompt: (o) => `Accept the return on #${o.orderNo}? The shop takes it back and refunds ${money(o.return?.amount ?? 0)} once they have it. Both sides read your note.`,
    placeholder: "For example: the photos show it arrived damaged.",
  },
  reject: {
    label: "Turn down the return",
    prompt: (o) => `Turn down the return on #${o.orderNo}? Both sides read your note.`,
    placeholder: "For example: it was used before it was sent back.",
    danger: true,
  },
  refund: {
    label: "Refund now",
    prompt: (o) => `Refund ${money(o.return?.amount ?? 0)} to the customer now, out of the shop’s share? Use this when the items are back or needn’t be. Both sides read your note.`,
    placeholder: "For example: the shop confirmed it’s back.",
  },
};

function returnActions(o: ConsoleOrder): Action[] {
  const s = o.return?.status;
  const refund: Action[] = o.releasedAt ? [] : ["refund"];
  if (s === "requested") return ["approve", ...refund, "reject"];
  if (s === "approved") return refund;
  if (s === "rejected") return ["approve", ...refund];
  return [];
}

function OrderCase({ o, onChanged }: { o: ConsoleOrder; onChanged: (next: ConsoleOrder) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("orders.manage");
  const [open, setOpen] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useActionKey();
  const status = DESK_STATUS[o.status];
  const cancelled = o.status === "cancelled";
  const canCancel = o.status !== "cancelled" && o.status !== "delivered";
  const actions = returnActions(o);
  const max = open === "cancel" ? 300 : 500;

  const run = async (action: Action) => {
    const text = note.trim();
    setBusy(true);
    try {
      const next =
        action === "cancel"
          ? await consoleCancelOrder(o.id, text, key.keyFor(`cancel:${o.id}:${text}`))
          : await consoleDecideReturn(o.id, { decision: action, note: text }, key.keyFor(`${action}:${o.id}:${text}`));
      key.settle();
      onChanged(next);
      setOpen(null);
      setNote("");
      toast(action === "cancel" ? "Order cancelled and refunded. Both sides have been told." : "Done. Both sides have been told.", "success");
    } catch (err) {
      key.settle(err);
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg" className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{`#${o.orderNo} · ${o.business.name}`}</h1>
          <p className={styles.muted}>{`${o.customer.name} · ${itemsText(o.lines)} · ${o.method === "pickup" ? "Pickup" : "Delivery"} · ${money(o.price.total)}`}</p>
          <p className={styles.muted}>{`Ordered ${momentText(o.createdAt)}`}</p>
        </div>
        <div className={styles.tags}>
          <Tag tone={status.tone}>{status.label}</Tag>
        </div>
      </div>

      {cancelled && (
        <p className={styles.note} data-tone="danger">
          {`${cancelledLine(o, true)}${o.cancellation?.reason ? `: ${o.cancellation.reason}` : ""}`}
        </p>
      )}
      {!cancelled && o.status !== "awaiting_payment" && <Timeline steps={orderTimeline(o, true)} />}

      {o.return && <ReturnCard ret={o.return} lines={o.lines} forShop />}

      {canManage && open && (
        <div className={order.panel}>
          <strong>{ACTION[open].prompt(o)}</strong>
          <TextArea label={open === "cancel" ? "Reason" : "Note"} value={note} onChange={setNote} max={max} placeholder={ACTION[open].placeholder} />
          <div className={styles.actions}>
            <Button variant={ACTION[open].danger ? "danger" : "primary"} loading={busy} disabled={note.trim().length < 5} onClick={() => void run(open)}>
              {ACTION[open].label}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(null)}>
              Not now
            </Button>
          </div>
        </div>
      )}
      {canManage && !open && (actions.length > 0 || canCancel) && (
        <div className={styles.actions}>
          {actions.map((a) => (
            <Button key={a} variant={ACTION[a].danger ? "danger" : "secondary"} onClick={() => setOpen(a)}>
              {ACTION[a].label}
            </Button>
          ))}
          {canCancel && (
            <Button variant="danger" onClick={() => setOpen("cancel")}>
              Cancel order
            </Button>
          )}
        </div>
      )}
      {o.return && o.releasedAt && o.return.status !== "refunded" && (
        <p className={styles.muted}>The shop has been paid for this order, so the return can’t be refunded here. Settle it through support.</p>
      )}

      <dl className={styles.facts}>
        <Fact label="Customer" value={[o.customer.name, o.customer.phone].filter(Boolean).join(" · ")} />
        {o.address && <Fact label="Deliver to" value={`${o.address.name} · ${o.address.phone} · ${o.address.line}, ${o.address.city} ${o.address.pincode}`} />}
        {o.delivery && <Fact label="Rider trip" value={o.delivery.status.replace(/_/g, " ")} />}
        <Fact label="Commission" value={money(o.commission)} />
        <Fact label="Shop’s share" value={money(o.vendorShare)} />
        <Fact label="Payout" value={o.releasedAt ? `Paid out ${momentText(o.releasedAt)}` : PAYOUT_LABEL[o.payout]} />
        {o.note && <Fact label="Customer’s note" value={o.note} />}
        <Fact label="Order id" value={o.id} />
      </dl>

      <section className={styles.group}>
        <h2 className={styles.subtitle}>Items</h2>
        <OrderLines lines={o.lines} showSku />
      </section>
      <OrderPrice o={o} />

      <div className={styles.actions}>
        <ButtonLink href={`/admin/stores/${o.business.id}`} variant="ghost" icon={<Icon name="store" size={18} />}>
          Open the shop
        </ButtonLink>
        <ButtonLink href={`/admin/users/${o.customerId}`} variant="ghost" icon={<Icon name="user" size={18} />}>
          Open the customer
        </ButtonLink>
      </div>
    </Card>
  );
}

/** One local shop order for the Ruxstar team: where it is, its money, cancelling it, and settling a return the shop turned down. */
export function StoreOrderCaseScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [o, setO] = useState<ConsoleOrder | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    consoleOrder(id).then(
      (next) => live && setO(next),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/store-orders" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            Shop orders
          </ButtonLink>
        </div>
        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !o ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <OrderCase o={o} onChanged={setO} />
        )}
      </div>
    </Needs>
  );
}
