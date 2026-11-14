"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { DeliverySection, type DeliveryDesk } from "@/components/shop/DeliverySection";
import { FileItem, PriceList, ProblemCard, Progress } from "@/components/shop/OrderParts";
import { Back } from "@/components/vendor/parts";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  assignShopDelivery,
  cancelShopDelivery,
  choiceLine,
  getShopOrder,
  isClosed,
  moveShopOrder,
  nextSteps,
  quantityLine,
  refundShopOrder,
  SHOP_STATUS_LABEL,
  shopDeliveryOptions,
  shopOrderFileLink,
  STATUS_TONE,
  STEP_ACTION,
  type PrintFile,
  type ShopOrder,
  type ShopStatus,
  type TeamOrder,
} from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import type { TeamPermission } from "@/lib/api/team";
import { contactSupport } from "@/lib/support";
import { ago, exact } from "@/lib/time";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";
import vendor from "@/components/vendor/vendor.module.css";

/** The owner's order calls or the team's, and where Back goes. */
export interface OrderDesk<T extends ShopOrder | TeamOrder> extends DeliveryDesk<T> {
  move: (id: string, status: ShopStatus, reason: string | undefined, idempotencyKey: string) => Promise<T>;
  fileLink: (id: string, fileId: string) => Promise<{ url: string }>;
  refund: (id: string, amount: number, reason: string, idempotencyKey: string) => Promise<T>;
  back: { href: string; label: string };
}

const SHOP_DESK: OrderDesk<ShopOrder> = {
  move: moveShopOrder,
  fileLink: shopOrderFileLink,
  refund: refundShopOrder,
  deliveryOptions: shopDeliveryOptions,
  assign: assignShopDelivery,
  cancelDelivery: cancelShopDelivery,
  back: { href: "/vendor/orders", label: "Orders" },
};

const teamOf = (order: ShopOrder | TeamOrder) => ("placeId" in order ? order : null);

/** A shop order for its owner, or for someone on its team with only what their permissions allow. */
export function ShopOrderDetails<T extends ShopOrder | TeamOrder>({ order, desk, onChanged }: { order: T; desk: OrderDesk<T>; onChanged: (order: T) => void }) {
  const team = teamOf(order);
  const can = (permission: TeamPermission) => !team || team.permissions.includes(permission);
  const { price } = order;
  const [moving, setMoving] = useState<ShopStatus | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keys = useRef<Partial<Record<ShopStatus, string>>>({});
  const refundKey = useRef(newIdempotencyKey());

  const move = async (status: ShopStatus) => {
    setMoving(status);
    setError(null);
    keys.current[status] ??= newIdempotencyKey();
    try {
      const next = await desk.move(order.id, status, status === "rejected" ? reason.trim() : undefined, keys.current[status]);
      keys.current = {};
      setRejecting(false);
      onChanged(next);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setMoving(null);
    }
  };

  const openFile = async (file: PrintFile) => {
    // Opened before the request so the browser does not block it as a pop-up.
    const tab = window.open("", "_blank");
    try {
      const { url } = await desk.fileLink(order.id, file.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(formError(err).message);
    }
  };

  const refundPaise = Math.round(Number(refundAmount || "0") * 100);
  const refundValid = refundPaise >= 100 && refundPaise <= order.refundable && refundReason.trim().length >= 5;

  const refund = async () => {
    setRefunding(true);
    setError(null);
    try {
      const next = await desk.refund(order.id, refundPaise, refundReason.trim(), refundKey.current);
      refundKey.current = newIdempotencyKey();
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      onChanged(next);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setRefunding(false);
    }
  };

  const steps = nextSteps(order).filter((status) => can(status === "rejected" ? "orders.reject" : "orders.move"));
  const closed = isClosed(order.status);
  const { address } = order;
  const partials = order.refunds.filter((r) => r.kind === "partial");
  const balance = team ? "the shop's available balance" : "your available balance";
  const moneyNote =
    price.payoutLeft === null
      ? "The owner hasn’t let you see what the shop earns."
      : order.status === "refunded"
        ? "Ruxstar refunded the customer in full, so there is no payout for this order."
        : order.releasedAt
          ? `${money(price.payoutLeft)} is in ${balance}.`
          : order.problem?.status === "open"
            ? "Held while Ruxstar looks into the customer’s problem."
            : order.releaseAt
              ? `Moves to ${balance} on ${exact(order.releaseAt)}, 48 hours after delivery.`
              : `Moves to ${balance} 48 hours after it is marked delivered.`;
  const shopMoney =
    price.payoutLeft === null || price.commission === null || price.commissionBps === null
      ? []
      : [
          ...(price.platformFee ? [{ label: "Platform fee, to Ruxstar", amount: price.platformFee, negative: true }] : []),
          { label: `Ruxstar commission, ${price.commissionBps / 100}%`, amount: price.commission, negative: true },
          ...(price.coupon?.fundedBy === "ruxstar" && price.discount ? [{ label: "Coupon, paid by Ruxstar", amount: price.discount }] : []),
          ...partials.map((r) => ({ label: `Refunded: ${r.reason ?? "partial refund"}`, amount: r.amount, negative: true })),
          { label: team ? "The shop gets" : "You get", amount: price.payoutLeft },
        ];

  return (
    <div className={vendor.page}>
      <Back href={desk.back.href}>{desk.back.label}</Back>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{`Order #${order.orderNo}`}</h1>
          <p className={styles.small}>{`${order.shop.name}${order.paidAt ? ` · paid ${ago(order.paidAt)}` : ""}`}</p>
        </div>
        <Tag tone={STATUS_TONE[order.status]}>{SHOP_STATUS_LABEL[order.status]}</Tag>
      </div>

      {order.status === "rejected" && (
        <div className={styles.news}>
          <strong>{team ? "The shop turned this order down" : "You turned this order down"}</strong>
          {order.reason && <p className={styles.small}>{order.reason}</p>}
          <p className={styles.small}>The customer was refunded in full.</p>
        </div>
      )}
      {order.status === "cancelled" && (
        <div className={styles.news}>
          <strong>{order.reason ? "Cancelled" : "The customer cancelled"}</strong>
          {order.reason && <p className={styles.small}>{order.reason}</p>}
          <p className={styles.small}>They were refunded in full. Nothing to make.</p>
        </div>
      )}
      {order.status === "refunded" && (
        <div className={styles.news}>
          <strong>Ruxstar refunded this order</strong>
          {order.reason && <p className={styles.small}>{order.reason}</p>}
        </div>
      )}
      {order.status === "placed" && order.acceptBy && (
        <div className={styles.news}>
          <strong>{`Accept by ${exact(order.acceptBy)}`}</strong>
          <p className={styles.small}>After that it is cancelled and the customer is refunded.</p>
        </div>
      )}
      {order.problem && (
        <section className={styles.section}>
          <h2 className={styles.overline}>Customer reported a problem</h2>
          <ProblemCard problem={order.problem} forShop />
        </section>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {rejecting ? (
        <div className={styles.news}>
          <strong>Turn down this order?</strong>
          <p className={styles.small}>{`The customer gets ${money(order.price.total)} back and sees your reason.`}</p>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="For example: out of XXL white shirts" />
          <div className={styles.actions}>
            <Button variant="danger" loading={moving === "rejected"} disabled={reason.trim().length < 5} onClick={() => void move("rejected")}>
              Turn down and refund
            </Button>
            <Button variant="ghost" disabled={moving === "rejected"} onClick={() => setRejecting(false)}>
              Keep the order
            </Button>
          </div>
        </div>
      ) : (
        steps.length > 0 && (
          <div className={styles.actions}>
            {steps.map((status) =>
              status === "rejected" ? (
                <Button key={status} variant="secondary" size="lg" disabled={!!moving} onClick={() => setRejecting(true)}>
                  {STEP_ACTION[status]}
                </Button>
              ) : (
                <Button key={status} size="lg" loading={moving === status} disabled={!!moving && moving !== status} onClick={() => void move(status)}>
                  {STEP_ACTION[status]}
                </Button>
              ),
            )}
          </div>
        )
      )}

      <DeliverySection order={order} desk={desk} canManage={can("orders.move")} onChanged={onChanged} />

      {!closed && (
        <section className={styles.section}>
          <h2 className={styles.overline}>Progress</h2>
          <Progress order={order} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.overline}>To print</h2>
        <div className={styles.panel}>
          <strong>{order.productLabel}</strong>
          <p className={styles.small}>{[quantityLine(order), choiceLine(order)].filter(Boolean).join(" · ")}</p>
          {order.note && <p>{`Note: ${order.note}`}</p>}
        </div>
        {order.files.map((file) => (
          <FileItem key={file.id} file={file} onOpen={closed ? undefined : () => void openFile(file)} />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Deliver to</h2>
        <div className={styles.panel}>
          <strong>{address.name}</strong>
          <p className={styles.small}>{`${address.line}, ${address.city} ${address.pincode}`}</p>
          <a href={`tel:+91${address.phone}`} className={styles.label}>
            {address.phone}
          </a>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Money</h2>
        <div className={styles.panel}>
          <PriceList price={price} pricing={order.pricing} after={shopMoney} />
          <p className={styles.faint}>{moneyNote}</p>
          {order.refundable >= 100 && !refundOpen && (
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => setRefundOpen(true)}>
                Refund part of this order
              </Button>
            </div>
          )}
        </div>
        {refundOpen && (
          <div className={styles.news}>
            <strong>Refund part of this order</strong>
            <p className={styles.small}>{`It comes out of ${team ? "the shop's" : "your"} share, up to ${money(order.refundable)}. The customer sees your reason and the order carries on.`}</p>
            <Input
              label="Amount"
              prefix="₹"
              inputMode="decimal"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\.\d{0,2}).*$/, "$1"))}
              placeholder="250"
              error={refundPaise > order.refundable ? `At most ${money(order.refundable)}.` : undefined}
            />
            <Input
              label="Reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              maxLength={300}
              placeholder="For example: 2 of the 12 shirts couldn't be printed"
            />
            <div className={styles.actions}>
              <Button loading={refunding} disabled={!refundValid} onClick={() => void refund()}>
                {refundPaise >= 100 ? `Refund ${money(refundPaise)}` : "Refund"}
              </Button>
              <Button variant="ghost" disabled={refunding} onClick={() => setRefundOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {!team && (
        <ButtonLink
          href={contactSupport("orders", { type: "order", id: order.id, label: `Order #${order.orderNo}` })}
          variant="ghost"
          icon={<Icon name="chat" size={16} />}
        >
          Get help with this order
        </ButtonLink>
      )}
    </div>
  );
}

/** One paid order to your shop: what to make, where it goes, what you earn, and the next step. Same as the app. */
export function ShopOrderScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      getShopOrder(id).then(
        (o) => {
          setOrder(o);
          setError(null);
        },
        (err) => !onSignedOut(err) && setError(err),
      ),
    [id, onSignedOut],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (order) return <ShopOrderDetails order={order} desk={SHOP_DESK} onChanged={setOrder} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/vendor/orders" variant="secondary">
            Orders
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
    <div className={vendor.page} aria-busy>
      <div className={shopStyles.skeletonCard} />
    </div>
  );
}
