import Link from "next/link";
import { Icon } from "@/components/ui";
import type { InvoiceRef } from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";
import { invoiceHref, issuedOn, refTitle, type InvoiceAudience } from "@/lib/invoices";
import styles from "@/components/shop/order.module.css";

/** An order's GST documents, each opening its invoice page. Nothing for orders paid before invoicing started. */
export function InvoiceLinks({ refs, audience }: { refs: InvoiceRef[] | undefined; audience: InvoiceAudience }) {
  if (!refs?.length) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.overline}>{refs.length === 1 ? "Invoice" : "Invoices"}</h2>
      <ul className={styles.rows}>
        {refs.map((ref) => (
          <li key={ref.id}>
            <Link href={invoiceHref(audience, ref.id)} className={styles.row}>
              <span className={styles.rowIcon}>
                <Icon name="receipt" size={20} />
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{refTitle(ref)}</span>
                <span className={styles.faint}>{`${ref.number} · ${issuedOn(ref.issuedAt)}`}</span>
              </span>
              <span className={styles.rowEnd}>{money(ref.total)}</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
