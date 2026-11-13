"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, Rows, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { ProblemCard } from "@/components/shop/OrderParts";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Input, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { orderProblems, settleOrder, type ProblemStatus, type SettleBody, type StaffOrder } from "@/lib/api/admin";
import { isClosed, PROBLEM_LABEL, SHOP_STATUS_LABEL } from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import { ago, exact } from "@/lib/time";

type Outcome = SettleBody["outcome"];

const SETTLE_TITLE: Record<Outcome, string> = {
  refund_full: "Refund in full",
  refund_partial: "Refund part",
  dismiss: "Close without a refund",
};

function SettleForm({ order, outcome, onCancel, onDone }: { order: StaffOrder; outcome: Outcome; onCancel: () => void; onDone: (order: StaffOrder) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const id = useId();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());

  const paise = Math.round(Number(amount || "0") * 100);
  const valid = note.trim().length >= 5 && (outcome !== "refund_partial" || (paise >= 100 && paise <= order.refundable));

  async function settle() {
    setBusy(true);
    try {
      onDone(await settleOrder(order.id, { outcome, note: note.trim(), ...(outcome === "refund_partial" ? { amount: paise } : {}) }, key.current));
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.reason}>
      <p className={styles.muted}>
        {outcome === "refund_full"
          ? `The customer gets ${money(order.price.total - order.refunded)} back and the order ends. The shop is not paid for it.`
          : outcome === "refund_partial"
            ? `It comes out of the shop's share, up to ${money(order.refundable)}. The order carries on.`
            : "No money moves. The shop's share is released once its hold is over."}
      </p>
      {outcome === "refund_partial" && (
        <Input
          label="Amount"
          prefix="₹"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\.\d{0,2}).*$/, "$1"))}
          error={paise > order.refundable ? `At most ${money(order.refundable)}.` : undefined}
        />
      )}
      <label className={styles.label} htmlFor={id}>
        Answer, shown to the customer and the shop
      </label>
      <textarea id={id} className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} autoFocus />
      <div className={styles.actions}>
        <span className={styles.count}>{note.length}/500</span>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={outcome === "dismiss" ? "secondary" : "danger"} disabled={!valid} loading={busy} onClick={() => void settle()}>
          {SETTLE_TITLE[outcome]}
        </Button>
      </div>
    </div>
  );
}

function ProblemDetail({ order, onDone }: { order: StaffOrder; onDone: (order: StaffOrder, outcome: Outcome) => void }) {
  const canSettle = useCan("orders.manage");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const open = order.problem?.status === "open";
  const fullAllowed = !order.releasedAt && !isClosed(order.status) && order.status !== "placed";

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Order" value={`#${order.orderNo} · ${SHOP_STATUS_LABEL[order.status]}`} />
        <Fact label="Paid" value={money(order.price.total)} />
        <Fact label="Customer" value={order.customer.username ? `${order.customer.name} (@${order.customer.username})` : order.customer.name} />
        <Fact label="Shop" value={`${order.shop.name} · ${order.vendor.name}`} />
        <Fact label="Refunded" value={money(order.refunded)} warn={order.refunded > 0} />
        <Fact label="Shop's share left" value={order.releasedAt ? `${money(order.price.payoutLeft)}, paid out` : money(order.price.payoutLeft)} />
        {order.readyBy && <Fact label="Promised ready" value={date(order.readyBy)} />}
        {order.deliveredAt && <Fact label="Delivered" value={date(order.deliveredAt)} />}
      </dl>
      {order.problem && <ProblemCard problem={order.problem} />}
      {order.refunds.map((r) => (
        <p key={r.at} className={styles.muted}>
          {`${money(r.amount)} ${r.kind === "full" ? "full refund" : "refunded"}${r.reason ? `: ${r.reason}` : ""} · ${r.status === "done" ? "sent" : "sending"}`}
        </p>
      ))}
      {open && !canSettle && <p className={styles.note}>Settling needs the “Refund and settle orders” permission.</p>}
      {open &&
        canSettle &&
        (outcome ? (
          <SettleForm order={order} outcome={outcome} onCancel={() => setOutcome(null)} onDone={(done) => onDone(done, outcome)} />
        ) : (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setOutcome("dismiss")}>
              Close without a refund
            </Button>
            {order.refundable >= 100 && (
              <Button variant="secondary" onClick={() => setOutcome("refund_partial")}>
                Refund part
              </Button>
            )}
            {fullAllowed && (
              <Button variant="danger" onClick={() => setOutcome("refund_full")}>
                {`Refund in full (${money(order.price.total - order.refunded)})`}
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}

/** Print orders with a reported problem. An open one holds the shop's share until someone here settles it. Same as the app. */
export function OrderProblemsQueue({ status }: { status: ProblemStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => orderProblems(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) return <p className={styles.empty}>{status === "open" ? "No order problems." : "Nothing settled yet."}</p>;

  return (
    <ul className={styles.list}>
      {items.map((o) => {
        const expanded = open === o.id;
        const resolution = o.problem?.resolution;
        const when = o.problem?.reportedAt ?? o.updatedAt;
        return (
          <li key={o.id} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : o.id)}>
              <Avatar name={o.customer.name} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{`#${o.orderNo} · ${o.problem ? PROBLEM_LABEL[o.problem.kind] : "Problem"}`}</span>
                <span className={`${styles.muted} ${styles.line}`}>{`${o.shop.name} · ${money(o.price.total)}`}</span>
              </span>
              {resolution ? (
                <Tag tone={resolution.outcome === "dismissed" ? "neutral" : "success"}>{resolution.outcome === "dismissed" ? "Closed" : "Refunded"}</Tag>
              ) : (
                <Tag tone="warning">Open</Tag>
              )}
              <time className={styles.time} dateTime={when} title={exact(when)}>
                {ago(when)}
              </time>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <ProblemDetail
                order={o}
                onDone={(done, outcome) => {
                  toast(outcome === "dismiss" ? "Closed. The customer and the shop were told." : "Refunded. The customer and the shop were told.", "success");
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.id !== done.id));
                }}
              />
            )}
          </li>
        );
      })}
      {hasMore && <li ref={sentinel} aria-hidden />}
      {loadingMore && <Skeleton height={72} radius={14} />}
    </ul>
  );
}
