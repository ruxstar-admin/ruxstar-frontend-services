"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, Rows, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { Button, Icon, Input, Segmented, Skeleton, Tag, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { checkPayout, heldOrders, listPayouts, releaseHeld, type HeldOrder, type PayoutStatus, type StaffPayout } from "@/lib/api/admin";
import { money } from "@/lib/api/shops";
import { newIdempotencyKey } from "@/lib/api/client";
import { ago, exact } from "@/lib/time";

type Tab = PayoutStatus | "held";

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "On the way" },
  { value: "failed", label: "Failed" },
  { value: "paid", label: "Paid" },
  { value: "held", label: "Held" },
];

const STATUS = {
  pending: { label: "On the way", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
} as const;

const MANAGE_NOTE = "This needs the “Release held money and check payouts” permission.";

function PayoutDetail({ payout, onChecked }: { payout: StaffPayout; onChecked: (after: StaffPayout) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("payouts.manage");
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      onChecked(await checkPayout(payout.id));
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Reaches the bank" value={money(payout.amount - payout.fee)} />
        <Fact label="Fee" value={money(payout.fee)} />
        <Fact label="To" value={payout.to} />
        <Fact label="Asked for" value={exact(payout.createdAt)} />
        <Fact label="Sent to Cashfree" value={`${payout.attempts} ${payout.attempts === 1 ? "time" : "times"}`} warn={payout.attempts > 1} />
        {payout.checkedAt && <Fact label="Last checked" value={ago(payout.checkedAt)} />}
        {payout.utr && <Fact label="Bank reference" value={payout.utr} />}
        {payout.paidAt && <Fact label="Paid" value={exact(payout.paidAt)} />}
        <Fact label="Transfer id" value={payout.transferId} />
      </dl>
      {payout.failure && (
        <p className={styles.note}>{`${payout.failure.text} (${payout.failure.code}) The money went back to the ${payout.payee === "partner" ? "partner's" : "vendor's"} balance.`}</p>
      )}
      {payout.status === "pending" &&
        (canManage ? (
          <div className={styles.actions}>
            <Button variant="secondary" loading={checking} onClick={() => void check()}>
              Check with Cashfree now
            </Button>
          </div>
        ) : (
          <p className={styles.note}>{MANAGE_NOTE}</p>
        ))}
    </div>
  );
}

function Payouts({ status }: { status: PayoutStatus }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => listPayouts(status, cursor), [status]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return <p className={styles.empty}>{status === "pending" ? "Nothing on the way." : status === "failed" ? "No failed payouts." : "No payouts yet."}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((p) => {
        const expanded = open === p.id;
        const when = p.paidAt ?? p.createdAt;
        return (
          <li key={p.id} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : p.id)}>
              <Avatar name={p.vendor.name} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{`${money(p.amount)} · ${p.vendor.name}`}</span>
                <span className={`${styles.muted} ${styles.line}`}>{p.to}</span>
              </span>
              {p.payee === "partner" && <Tag tone="neutral">Partner</Tag>}
              <Tag tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Tag>
              <time className={styles.time} dateTime={when} title={exact(when)}>
                {ago(when)}
              </time>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <PayoutDetail
                payout={p}
                onChecked={(after) => {
                  if (after.status === status) {
                    setItems((list) => list.map((x) => (x.id === after.id ? after : x)));
                    toast("Cashfree has no answer yet. It is checked again every few minutes.", "neutral");
                    return;
                  }
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.id !== after.id));
                  toast(
                    after.status === "paid" ? `${money(after.amount - after.fee)} reached ${p.vendor.name}.` : `It failed. ${money(after.amount)} went back to ${p.vendor.name}'s balance.`,
                    after.status === "paid" ? "success" : "danger",
                  );
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

function HeldDetail({ order, onReleased }: { order: HeldOrder; onReleased: () => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canManage = useCan("payouts.manage");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newIdempotencyKey());

  async function release(reason: string) {
    setBusy(true);
    try {
      await releaseHeld(order.id, reason, key.current);
      key.current = newIdempotencyKey();
      onReleased();
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <Fact label="Shop's share" value={money(order.amount)} />
        <Fact label="Vendor" value={order.vendor.name} />
        {order.deliveredAt && <Fact label="Delivered" value={exact(order.deliveredAt)} />}
        <Fact label="Available on its own" value={order.problemOpen ? "After the problem is settled" : exact(order.releaseAt)} />
        {order.partner && <Fact label={`Partner pay · ${order.partner.rider.name}`} value={money(order.partner.amount)} />}
        {order.partner && (
          <Fact
            label="Partner can withdraw it"
            value={order.partner.held ? "After the “never arrived” report is settled" : exact(order.partner.releaseAt)}
            warn={order.partner.held}
          />
        )}
      </dl>
      {order.problemOpen ? (
        <p className={styles.note}>A customer reported a problem. Settle it in Reports first, so a refund can still come out of the share.</p>
      ) : !canManage ? (
        <p className={styles.note}>{MANAGE_NOTE}</p>
      ) : asking ? (
        <ReasonForm
          prompt="Why release it now? This is kept in the audit log."
          placeholder="For example: the customer confirmed they got it."
          confirm={`Release ${money(order.amount)}`}
          busy={busy}
          onCancel={() => setAsking(false)}
          onSubmit={(reason) => void release(reason)}
        />
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Release now
          </Button>
        </div>
      )}
    </div>
  );
}

function HeldList({ orderNo }: { orderNo: number | undefined }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback((cursor?: string) => heldOrders(orderNo, cursor), [orderNo]);
  const { items, setItems, loading, loadingMore, hasMore, error, more, reload } = usePages(load);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {orderNo ? `Order #${orderNo} isn't on hold. It may not be delivered yet, or its share is already available.` : "Nothing on hold."}
      </p>
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((o) => {
        const expanded = open === o.id;
        return (
          <li key={o.id} className={styles.item} data-open={expanded || undefined}>
            <button type="button" className={styles.row} aria-expanded={expanded} onClick={() => setOpen(expanded ? null : o.id)}>
              <Avatar name={o.business?.name ?? o.vendor.name} size={44} />
              <span className={styles.whoRow}>
                <span className={styles.name}>{`#${o.orderNo} · ${money(o.amount)}`}</span>
                <span className={`${styles.muted} ${styles.line}`}>
                  {`${o.business?.name ?? "Shop"} · ${o.problemOpen ? "problem reported" : `available ${exact(o.releaseAt)}`}`}
                </span>
              </span>
              <Tag tone={o.problemOpen ? "warning" : "neutral"}>{o.problemOpen ? "Problem" : "On hold"}</Tag>
              <Icon name="chevron-down" size={20} className={styles.chevron} />
            </button>
            {expanded && (
              <HeldDetail
                order={o}
                onReleased={() => {
                  toast(`Released. ${o.vendor.name} can withdraw ${money(o.amount)} now and was told.`, "success");
                  setOpen(null);
                  setItems((list) => list.filter((x) => x.id !== o.id));
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

function Held() {
  const [text, setText] = useState("");
  const [orderNo, setOrderNo] = useState<number | undefined>();
  useEffect(() => {
    const t = setTimeout(() => setOrderNo(text ? Number(text) : undefined), 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          label="Find an order"
          placeholder="Order number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 9))}
          autoComplete="off"
        />
      </div>
      <HeldList key={orderNo ?? "all"} orderNo={orderNo} />
    </>
  );
}

/** Vendors' and delivery partners' withdrawals by status, and order shares still on hold that the team can release early. Same as the app. */
export function PayoutsScreen() {
  const [tab, setTab] = useState<Tab>("pending");
  return (
    <Needs need="payouts.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <h1 className={styles.title}>Payouts</h1>
          <Segmented label="Show" options={TABS} value={tab} onChange={setTab} />
        </div>
        {tab === "held" ? <Held /> : <Payouts key={tab} status={tab} />}
      </div>
    </Needs>
  );
}
