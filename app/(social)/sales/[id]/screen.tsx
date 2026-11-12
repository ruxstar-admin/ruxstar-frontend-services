"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Input, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { FileItem, PriceList, Progress } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  choiceLine,
  getShopOrder,
  moveShopOrder,
  nextSteps,
  quantityLine,
  SHOP_STATUS_LABEL,
  shopOrderFileLink,
  STATUS_TONE,
  STEP_ACTION,
  type PrintFile,
  type ShopOrder,
  type ShopStatus,
} from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { ago } from "@/lib/time";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";

function ShopOrderDetails({ order, onChanged }: { order: ShopOrder; onChanged: (order: ShopOrder) => void }) {
  const [moving, setMoving] = useState<ShopStatus | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const keys = useRef<Partial<Record<ShopStatus, string>>>({});

  const move = async (status: ShopStatus) => {
    setMoving(status);
    setError(null);
    keys.current[status] ??= newIdempotencyKey();
    try {
      const next = await moveShopOrder(order.id, status, status === "rejected" ? reason.trim() : undefined, keys.current[status]);
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
      const { url } = await shopOrderFileLink(order.id, file.id);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(formError(err).message);
    }
  };

  const steps = nextSteps(order.status);
  const closed = order.status === "rejected" || order.status === "cancelled";
  const { address } = order;

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{`Order #${order.orderNo}`}</h1>
          <p className={styles.small}>{`${order.shop.name}${order.paidAt ? ` · paid ${ago(order.paidAt)}` : ""}`}</p>
        </div>
        <Tag tone={STATUS_TONE[order.status]}>{SHOP_STATUS_LABEL[order.status]}</Tag>
      </div>

      {order.status === "rejected" && (
        <div className={styles.news}>
          <strong>You turned this order down</strong>
          {order.reason && <p className={styles.small}>{order.reason}</p>}
          <p className={styles.small}>The customer was refunded in full.</p>
        </div>
      )}
      {order.status === "cancelled" && (
        <div className={styles.news}>
          <strong>The customer cancelled</strong>
          <p className={styles.small}>They were refunded in full. Nothing to make.</p>
        </div>
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
          <PriceList
            price={order.price}
            pricing={order.pricing}
            after={[
              ...(order.price.platformFee ? [{ label: "Platform fee, to Ruxstar", amount: order.price.platformFee, negative: true }] : []),
              { label: `Ruxstar commission, ${order.price.commissionBps / 100}%`, amount: order.price.commission, negative: true },
              { label: "You get", amount: order.price.payout },
            ]}
          />
          <p className={styles.faint}>
            {order.status === "delivered" ? `${money(order.price.payout)} is in your available balance.` : "Moves to your available balance when you mark it delivered."}
          </p>
        </div>
      </section>
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

  if (order) return <ShopOrderDetails order={order} onChanged={setOrder} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Order not found" : "Could not load this order"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href="/sales" variant="secondary">
            Shop orders
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
