import Link from "next/link";
import type { Invoice } from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";
import { INVOICE_KIND, invoiceHref, issuedOn, type InvoiceAudience } from "@/lib/invoices";
import styles from "./invoices.module.css";

/** Credit notes take money back, so they read as minus in a list of sales. */
const signed = (d: Invoice, paise: number) => (d.kind === "credit_note" && paise ? `−${money(paise)}` : money(paise));

/** Documents as rows for a business's or the console's list; each number opens the document. */
export function InvoiceTable({ items, audience, caption, showBusiness }: { items: Invoice[]; audience: InvoiceAudience; caption: string; showBusiness: boolean }) {
  return (
    <div className={styles.tableWrap} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            {showBusiness && <th scope="col">Business</th>}
            <th scope="col">Customer</th>
            <th scope="col">Order</th>
            <th scope="col" className={styles.num}>
              Taxable value
            </th>
            <th scope="col" className={styles.num}>
              GST
            </th>
            <th scope="col" className={styles.num}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <th scope="row">
                <Link href={invoiceHref(audience, d.id)}>{d.number}</Link>
              </th>
              <td>{issuedOn(d.issuedAt)}</td>
              <td>{d.role === "fee" ? `${INVOICE_KIND[d.kind]} (Ruxstar fee)` : INVOICE_KIND[d.kind]}</td>
              {showBusiness && <td>{d.business.name}</td>}
              <td>{d.buyer.name}</td>
              <td>{`#${d.order.orderNo}`}</td>
              <td className={styles.num}>{signed(d, d.totals.taxable)}</td>
              <td className={styles.num}>{signed(d, d.totals.tax)}</td>
              <td className={styles.num}>{signed(d, d.totals.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
