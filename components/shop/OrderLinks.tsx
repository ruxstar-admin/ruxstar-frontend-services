"use client";

import Link from "next/link";
import { Button, ButtonLink, Icon, useToast } from "@/components/ui";
import { exact } from "@/lib/time";
import styles from "@/components/shop/order.module.css";

/** Which business an order belongs to; with `href`, it opens that business. Same as the app. */
export function OrderBusiness({ label, name, href }: { label: string; name: string; href?: string }) {
  const body = (
    <>
      <span className={styles.rowIcon}>
        <Icon name="print" size={20} />
      </span>
      <span className={styles.rowText}>
        <span className={styles.faint}>{label}</span>
        <span className={styles.rowTitle}>{name}</span>
      </span>
      {href && <Icon name="chevron-right" size={18} />}
    </>
  );
  return href ? (
    <Link href={href} className={styles.row}>
      {body}
    </Link>
  ) : (
    <div className={styles.row}>{body}</div>
  );
}

/** When and how an order was paid, with a link to the payment. Same as the app. */
export function OrderPayment({ paidAt, paymentId, payer, href, linkLabel }: { paidAt: string; paymentId: string | null; payer?: string; href: string; linkLabel: string }) {
  const toast = useToast();
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Payment ID copied", "neutral");
    } catch {
      toast("Couldn't copy. Select the ID and copy it yourself.", "danger");
    }
  };
  return (
    <div className={styles.panel}>
      <dl className={styles.paymentFacts}>
        {payer && (
          <div>
            <dt>Paid by</dt>
            <dd>{payer}</dd>
          </div>
        )}
        <div>
          <dt>Paid on</dt>
          <dd>{exact(paidAt)}</dd>
        </div>
        {paymentId && (
          <div>
            <dt>Payment ID</dt>
            <dd className={styles.paymentId}>
              <span>{paymentId}</span>
              <Button variant="ghost" onClick={() => void copy(paymentId)}>
                <Icon name="copy" size={16} />
                Copy
              </Button>
            </dd>
          </div>
        )}
      </dl>
      <div className={styles.actions}>
        <ButtonLink href={href} variant="secondary">
          {linkLabel}
        </ButtonLink>
      </div>
    </div>
  );
}
