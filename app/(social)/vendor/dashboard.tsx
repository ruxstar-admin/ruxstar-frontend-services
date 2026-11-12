"use client";

import Link from "next/link";
import { ButtonLink, Icon } from "@/components/ui";
import { Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { money } from "@/lib/api/shops";
import { canOpen, listOf, MISSING_LABEL, myBusinesses, vendorPayments } from "@/lib/api/vendor";
import styles from "@/components/vendor/vendor.module.css";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Counts, what still needs setting up, and the balance. Opening and closing is per business, on Businesses. Same as the app. */
export function VendorDashboard() {
  const businesses = useLoad(myBusinesses);
  const payments = useLoad(vendorPayments);

  if (businesses.error && !businesses.data) return <Failed error={businesses.error} onRetry={businesses.reload} />;
  if (!businesses.data) return <Loading rows={2} />;

  const list = businesses.data;
  const drafts = list.filter((b) => b.status === "draft" && !b.suspension);
  const openable = list.filter(canOpen);
  const open = openable.filter((b) => b.open).length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>

      {list.length ? (
        <>
          <div className={styles.card}>
            <dl className={styles.stats}>
              <Stat value={String(open)} label="Open" />
              <Stat value={String(openable.length - open)} label="Closed" />
              <Stat value={String(drafts.length)} label="Drafts" />
            </dl>
          </div>

          {drafts.length > 0 && (
            <>
              <h2 className={styles.overline}>Finish setting up</h2>
              <ul className={styles.rows}>
                {drafts.map((b) => (
                  <li key={b.id}>
                    <Link href={`/vendor/businesses/${b.id}`} className={styles.row}>
                      <Icon name="edit" size={20} />
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle}>{b.name}</span>
                        <span className={styles.rowLine}>{b.missing.length ? `Add ${listOf(b.missing.map((m) => MISSING_LABEL[m]))}` : "Ready to publish"}</span>
                      </span>
                      <Icon name="chevron-right" size={18} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <div className={styles.card}>
          <h2 className={styles.cardHead}>Open your first business</h2>
          <p className={styles.muted}>Print on demand, events, coaching or stays. You can run up to 10.</p>
          <div>
            <ButtonLink href="/vendor/businesses/new">Add a business</ButtonLink>
          </div>
        </div>
      )}

      {payments.data && (
        <Link href="/vendor/payments" className={styles.card}>
          <span className={styles.cardHead}>
            Payments
            <Icon name="chevron-right" size={18} />
          </span>
          <dl className={styles.stats}>
            <Stat value={money(payments.data.balance.available)} label="Available" />
            <Stat value={money(payments.data.balance.paidOut)} label="Paid out" />
          </dl>
          {!payments.data.payoutMethod && (
            <span className={styles.note}>
              <Icon name="alert" size={18} />
              Add the bank account or UPI ID you get paid to
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
