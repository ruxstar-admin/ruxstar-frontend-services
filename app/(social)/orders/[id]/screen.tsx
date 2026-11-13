"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { FileItem, PriceList, ProblemCard, Progress } from "@/components/shop/OrderParts";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  addProblemPhoto,
  cancelOrder,
  choiceLine,
  dayLabel,
  getOrder,
  isClosed,
  isFinished,
  orderFileLink,
  payOrder,
  PROBLEM_KINDS,
  PROBLEM_LABEL,
  quantityLine,
  refundLine,
  reportProblem,
  STATUS_LABEL,
  STATUS_TONE,
  type Order,
  type PrintFile,
  type ProblemKind,
} from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { shrinkPhoto } from "@/lib/photo";
import { exact } from "@/lib/time";
import shopStyles from "@/components/shop/shop.module.css";
import styles from "@/components/shop/order.module.css";

const POLL_MS = 8000;
const PHOTO_SIDE = 1600;

function News({ order }: { order: Order }) {
  const full = order.refunds.find((r) => r.kind === "full");
  if (order.status === "rejected") {
    return (
      <div className={styles.news}>
        <strong>{`${order.shop.name} couldn't take this order`}</strong>
        {order.reason && <p className={styles.small}>{order.reason}</p>}
        {full && <p className={styles.small}>{refundLine(full)}</p>}
      </div>
    );
  }
  if (order.status === "cancelled") {
    return (
      <div className={styles.news}>
        <strong>Cancelled</strong>
        {order.reason && <p className={styles.small}>{order.reason}</p>}
        <p className={styles.small}>{full ? refundLine(full) : "Nothing was charged."}</p>
      </div>
    );
  }
  if (order.status === "refunded") {
    return (
      <div className={styles.news}>
        <strong>Refunded by Ruxstar</strong>
        {order.reason && <p className={styles.small}>{order.reason}</p>}
        {full && <p className={styles.small}>{refundLine(full)}</p>}
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
  if (order.status === "placed" && order.acceptBy) {
    return (
      <div className={styles.news}>
        <strong>{`Waiting for ${order.shop.name}`}</strong>
        <p className={styles.small}>{`If they don't accept by ${exact(order.acceptBy)}, it's cancelled and you get it all back.`}</p>
      </div>
    );
  }
  return null;
}

/** Kind and a note; photos are added one by one from the problem card after. */
function ReportForm({ order, onReported, onClose }: { order: Order; onReported: (order: Order) => void; onClose: () => void }) {
  const [kind, setKind] = useState<ProblemKind>(order.status === "delivered" ? "wrong_item" : "not_received");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      onReported(await reportProblem(order.id, { kind, note: note.trim() }, key.current));
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.news}>
      <strong>Report a problem</strong>
      <p className={styles.small}>{"Ruxstar looks into it and replies here. The shop isn't paid until then."}</p>
      <div className={shopStyles.chips} role="group" aria-label="What went wrong">
        {PROBLEM_KINDS.map((k) => (
          <button key={k} type="button" className={shopStyles.chip} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {PROBLEM_LABEL[k]}
          </button>
        ))}
      </div>
      <label className={styles.label} htmlFor="problem-note">
        What went wrong
      </label>
      <textarea
        id="problem-note"
        className={styles.textarea}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        placeholder="For example: the design is printed upside down"
      />
      <p className={styles.faint}>You can add up to 3 photos after you send this.</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button loading={sending} disabled={note.trim().length < 3} onClick={() => void send()}>
          Send to Ruxstar
        </Button>
        <Button variant="ghost" disabled={sending} onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}

function OrderDetails({ order, onChanged }: { order: Order; onChanged: (order: Order) => void }) {
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoKey = useRef(newIdempotencyKey());
  const cancelKey = useRef(newIdempotencyKey());

  const addPhoto = async (file: File) => {
    setAdding(true);
    setError(null);
    try {
      const next = await addProblemPhoto(order.id, await shrinkPhoto(file, PHOTO_SIDE), photoKey.current);
      photoKey.current = newIdempotencyKey();
      onChanged(next);
    } catch (err) {
      setError(formError(err).message);
    } finally {
      setAdding(false);
    }
  };

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
      onChanged(await cancelOrder(order.id, cancelKey.current));
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
  const moving = order.status !== "awaiting_payment" && !isClosed(order.status);
  const inHand = moving && order.status !== "placed" && order.status !== "delivered";
  const partials = order.refunds.filter((r) => r.kind === "partial");

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{`Order #${order.orderNo}`}</h1>
          <p className={styles.small}>{inHand && order.readyBy ? `${order.shop.name} · ready by ${dayLabel(order.readyBy)}` : order.shop.name}</p>
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

      {order.problem ? (
        <section className={styles.section}>
          <h2 className={styles.overline}>Your report</h2>
          <ProblemCard problem={order.problem} onAddPhoto={(file) => void addPhoto(file)} adding={adding} />
        </section>
      ) : reporting ? (
        <ReportForm
          order={order}
          onClose={() => setReporting(false)}
          onReported={(next) => {
            setReporting(false);
            onChanged(next);
          }}
        />
      ) : (
        order.canReport && (
          <div className={styles.actions}>
            <Button variant="secondary" icon={<Icon name="flag" size={16} />} onClick={() => setReporting(true)}>
              Report a problem
            </Button>
            <p className={styles.faint}>
              {order.reportUntil ? `Until ${exact(order.reportUntil)}. After that, the shop is paid.` : "It is past the date the shop promised."}
            </p>
          </div>
        )
      )}

      {partials.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.overline}>Refunds</h2>
          <div className={styles.panel}>
            {partials.map((r) => (
              <div key={r.at}>
                <strong>{r.reason ?? "Refund"}</strong>
                <p className={styles.small}>{refundLine(r)}</p>
              </div>
            ))}
          </div>
        </section>
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
