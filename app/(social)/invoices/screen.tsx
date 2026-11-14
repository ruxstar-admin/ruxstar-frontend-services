"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { formError } from "@/lib/api/account";
import { myInvoices } from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";
import { INVOICE_KIND, invoiceHref, issuedOn, KIND_TONE, refTitle } from "@/lib/invoices";
import social from "@/components/social/social.module.css";
import styles from "@/components/shop/order.module.css";

/** Every GST document for what you bought, newest first: the business's invoice, Ruxstar's for its fee, and credit notes for refunds. */
export function InvoicesScreen() {
  const onSignedOut = useOnSignedOut();
  const { items, loading, loadingMore, hasMore, error, more, reload, moreFailed } = usePages(myInvoices);
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Your invoices</h1>
        <p className={styles.small}>GST invoices and credit notes for your orders and bookings. Open one to download its PDF.</p>
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
        <Empty title="No invoices yet">
          <p>When you pay for an order, its GST invoice shows up here. Refunds add a credit note.</p>
          <ButtonLink href="/payments" variant="secondary">
            Your payments
          </ButtonLink>
        </Empty>
      ) : (
        <ul className={styles.rows}>
          {items.map((d) => (
            <li key={d.id}>
              <Link href={invoiceHref("customer", d.id)} className={styles.row}>
                <span className={styles.rowIcon}>
                  <Icon name="receipt" size={20} />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{d.business.name}</span>
                  <span className={styles.faint}>{`${refTitle(d)} · ${d.number} · ${issuedOn(d.issuedAt)}`}</span>
                </span>
                <span className={styles.rowEnd}>
                  <strong>{money(d.totals.payable)}</strong>
                  <Tag tone={KIND_TONE[d.kind]}>{INVOICE_KIND[d.kind]}</Tag>
                </span>
              </Link>
            </li>
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
