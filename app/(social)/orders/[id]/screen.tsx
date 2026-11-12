"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { FileItem, PriceList, Progress } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import {
  cancelOrder,
  choiceLine,
  getOrder,
  isFinished,
  orderFileLink,
  payOrder,
  quantityLine,
  STATUS_LABEL,
  STATUS_TONE,
  type Order,
  type PrintFile,
} from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";

const POLL_MS = 8000;

const refundLine = (refund: NonNullable<Order["refund"]>) =>
  refund.status === "done" ? `${money(refund.amount)} refunded to how you paid. Banks take up to 7 days to show it.` : `Refunding ${money(refund.amount)}…`;

function News({ order }: { order: Order }) {
  if (order.status === "rejected") {
    return (
      <div className={styles.news}>
        <strong>{`${order.shop.name} couldn't take this order`}</strong>
        {order.reason && <p className={styles.small}>{order.reason}</p>}
        {order.refund && <p className={styles.small}>{refundLine(order.refund)}</p>}
      </div>
    );
  }
  if (order.status === "cancelled") {
    return (
      <div className={styles.news}>
        <strong>Cancelled</strong>
        <p className={styles.small}>{order.refund ? refundLine(order.refund) : "Nothing was charged."}</p>
      </div>
    );
  }
  if (order.status === "awaiting_payment") {
    return (
      <div className={styles.news}>
        <strong>Not paid yet</strong>
        <p className={styles.small}>{`${order.shop.name} gets the order once you pay.`}</p>
      </div>
    );
  }
  return null;
}

function OrderDetails({ order, onChanged }: { order: Order; onChanged: (order: Order) => void }) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { checkoutUrl } = await payOrder(order.id, `${window.location.origin}/orders`);
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
      onChanged(await cancelOrder(order.id));
      setConfirming(false);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setCancelling(false);
    }
  };

  const openFile = async (file: PrintFile) => {
    // Opened before the request so the browser does not block it as a pop-up.
    const tab = window.open("", "_blank");
    try {
      const { url } = await orderFileLink(order.id, file.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(formError(err).message);
    }
  };

  const cancellable = order.status === "awaiting_payment" || order.status === "placed";
  const moving = !["awaiting_payment", "rejected", "cancelled"].includes(order.status);

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{`Order #${order.orderNo}`}</h1>
          <p className={styles.small}>{order.shop.name}</p>
        </div>
        <Tag tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Tag>
      </div>

      <News order={order} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {order.status === "awaiting_payment" && (
        <Button size="lg" onClick={pay} loading={paying}>
          {`Pay ${money(order.price.total)}`}
        </Button>
      )}

      {moving && (
        <section className={styles.section}>
          <h2 className={styles.overline}>Progress</h2>
          <Progress order={order} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.overline}>Your print</h2>
        <div className={styles.panel}>
          <strong>{order.productLabel}</strong>
          <p className={styles.small}>{[quantityLine(order), choiceLine(order)].filter(Boolean).join(" · ")}</p>
          {order.note && <p className={styles.small}>{`Note: ${order.note}`}</p>}
        </div>
        {order.files.map((file) => (
          <FileItem key={file.id} file={file} onOpen={() => void openFile(file)} />
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Deliver to</h2>
        <div className={styles.panel}>
          <strong>{order.address.name}</strong>
          <p className={styles.small}>{`${order.address.line}, ${order.address.city} ${order.address.pincode}`}</p>
          <p className={styles.small}>{order.address.phone}</p>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.overline}>Payment</h2>
        <div className={styles.panel}>
          <PriceList price={order.price} pricing={order.pricing} />
        </div>
      </section>

      {cancellable &&
        (confirming ? (
          <div className={styles.news}>
            <strong>Cancel this order?</strong>
            <p className={styles.small}>{order.status === "placed" ? `You get the full ${money(order.price.total)} back.` : "Nothing has been charged."}</p>
            <div className={styles.actions}>
              <Button variant="danger" loading={cancelling} onClick={cancel}>
                Cancel order
              </Button>
              <Button variant="ghost" disabled={cancelling} onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Cancel order
          </Button>
        ))}
    </div>
  );
}

/** A customer's print order. While it is moving it refreshes itself; opening it also checks for a payment. Same as the app. */
export function OrderScreen({ id }: { id: string }) {
  const onSignedOut = useOnSignedOut();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const finished = order ? isFinished(order.status) : false;

  const load = useCallback(
    () =>
      getOrder(id).then(
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

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [finished, load]);

  if (order) return <OrderDetails order={order} onChanged={setOrder} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/orders" variant="secondary">
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
    <div className={styles.page} aria-busy>
      <div className={shopStyles.skeletonCard} />
    </div>
  );
}
