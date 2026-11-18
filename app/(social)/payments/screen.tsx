"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, Icon, Tag, useToast, type IconName } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { formError } from "@/lib/api/account";
import { myPayment, myPayments, PAYMENT_STATUS, type Payment } from "@/lib/api/payments";
import { money, type BusinessModule } from "@/lib/api/shops";
import { ago, exact } from "@/lib/time";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";

const MODULE_ICON: Record<BusinessModule, IconName> = { pod: "print", events: "ticket", coaching: "book", stays: "home", turf: "ball", shop: "bag", gigs: "briefcase" };
const ORDER_PATH: Record<BusinessModule, string> = {
  pod: "/orders",
  events: "/tickets",
  coaching: "/classes",
  stays: "/reservations",
  turf: "/bookings",
  shop: "/orders/shop",
  gigs: "/orders/freelance",
};

function PaymentItem({ payment, open, onToggle }: { payment: Payment; open: boolean; onToggle: () => void }) {
  const toast = useToast();
  const status = PAYMENT_STATUS[payment.status];
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Payment ID copied", "neutral");
    } catch {
      toast("Couldn't copy. Select the ID and copy it yourself.", "danger");
    }
  };

  return (
    <li className={styles.payment}>
      <button type="button" className={styles.row} aria-expanded={open} onClick={onToggle}>
        <span className={styles.rowIcon}>
          <Icon name={MODULE_ICON[payment.module]} size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{payment.business.name}</span>
          <span className={styles.faint}>{`#${payment.order.orderNo} · ${payment.order.label} · ${ago(payment.paidAt)}`}</span>
          {payment.refunded > 0 && <span className={styles.paymentBack}>{`${money(payment.refunded)} back`}</span>}
        </span>
        <span className={styles.rowEnd}>
          <strong>{money(payment.amount)}</strong>
          <Tag tone={status.tone}>{status.label}</Tag>
        </span>
      </button>
      {open && (
        <div className={styles.paymentDetails}>
          <dl className={styles.paymentFacts}>
            <div>
              <dt>Paid to</dt>
              <dd>{payment.business.name}</dd>
            </div>
            <div>
              <dt>For</dt>
              <dd>{`Order #${payment.order.orderNo} · ${payment.order.label}`}</dd>
            </div>
            <div>
              <dt>Paid on</dt>
              <dd>{exact(payment.paidAt)}</dd>
            </div>
            {payment.paymentId && (
              <div>
                <dt>Payment ID</dt>
                <dd className={styles.paymentId}>
                  <span>{payment.paymentId}</span>
                  <Button variant="ghost" onClick={() => void copy(payment.paymentId!)}>
                    <Icon name="copy" size={16} />
                    Copy
                  </Button>
                </dd>
              </div>
            )}
          </dl>
          {payment.refunds.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.overline}>Refunds</h2>
              {payment.refunds.map((r, i) => (
                <div key={`${r.at}-${i}`} className={styles.paymentRefund}>
                  <span className={styles.rowText}>
                    <span>{r.kind === "full" ? "Full refund" : (r.reason ?? "Part refund")}</span>
                    <span className={styles.faint}>{`${exact(r.at)} · ${r.status === "done" ? "Refunded" : "Refunding…"}`}</span>
                  </span>
                  <strong className={styles.paymentBack}>{`+${money(r.amount)}`}</strong>
                </div>
              ))}
              <p className={styles.faint}>Refunds go back to how you paid. Banks take up to 7 days to show them.</p>
            </div>
          )}
          <div className={styles.actions}>
            <ButtonLink href={`${ORDER_PATH[payment.module]}/${payment.order.id}`} variant="secondary">
              View order
            </ButtonLink>
          </div>
        </div>
      )}
    </li>
  );
}

/** What you paid, at every business, and what came back. `openId` (an order ID) shows that payment first, open. Same as the app's Your payments. */
export function PaymentsScreen({ openId }: { openId?: string }) {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload, moreFailed } = usePages(myPayments);
  const sentinel = useNearEnd(more, hasMore && !error);
  const [open, setOpen] = useState<string | null>(openId ?? null);
  const [picked, setPicked] = useState<Payment | null>(null);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  useEffect(() => {
    if (!openId) return;
    let live = true;
    myPayment(openId)
      .then((payment) => live && setPicked(payment))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [openId]);

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Your payments</h1>
        <ButtonLink href="/invoices" variant="secondary" icon={<Icon name="receipt" size={18} />}>
          Invoices
        </ButtonLink>
      </div>
      {loading ? (
        <SkeletonRows />
      ) : error && items.length === 0 ? (
        <div className={social.failed} role="alert">
          <p>{formError(error).message}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty title="No payments yet">
          <p>What you pay for orders shows up here, with any refunds.</p>
          <ButtonLink href="/discover" variant="secondary">
            Find a print shop
          </ButtonLink>
        </Empty>
      ) : (
        <ul className={styles.rows}>
          {picked && <PaymentItem payment={picked} open={open === picked.id} onToggle={() => setOpen(open === picked.id ? null : picked.id)} />}
          {items.filter((p) => p.id !== picked?.id).map((p) => (
            <PaymentItem key={p.id} payment={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
          ))}
          {hasMore && !moreFailed && <li ref={sentinel} className={social.sentinel} aria-hidden />}
          {moreFailed && (
            <li role="alert">
              <Button variant="ghost" onClick={more}>
                Couldn&apos;t load more. Try again
              </Button>
            </li>
          )}
          {loadingMore && <SkeletonRows count={1} />}
        </ul>
      )}
    </div>
  );
}
