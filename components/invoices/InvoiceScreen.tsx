"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { formError } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { myInvoice, myInvoices, staffInvoice, staffInvoices, vendorInvoice, vendorInvoices, type Invoice } from "@/lib/api/invoices";
import { money } from "@/lib/api/shops";
import { INVOICE_HOME, INVOICE_KIND, invoiceHref, isSeller, issuedOn, KIND_TONE, percent, refTitle, type InvoiceAudience } from "@/lib/invoices";
import order from "@/components/shop/order.module.css";
import shop from "@/components/shop/shop.module.css";
import styles from "./invoices.module.css";

/** Signed PDF links work for 10 minutes; older ones are fetched again first. */
const LINK_FRESH_MS = 8 * 60_000;

const LOAD: Record<InvoiceAudience, (id: string) => Promise<Invoice>> = { customer: myInvoice, vendor: vendorInvoice, freelance: vendorInvoice, staff: staffInvoice };

const HOME_LABEL: Record<InvoiceAudience, string> = { customer: "Your invoices", vendor: "GST invoices", freelance: "GST invoices", staff: "Invoices" };

/**
 * The order's other documents: Ruxstar's fee invoice (not for businesses), and credit notes for refunds, asked for by
 * the order's id. Same as the app.
 */
async function relatedTo(invoice: Invoice, audience: InvoiceAudience): Promise<Invoice[]> {
  const orderId = invoice.order.id;
  const others = (items: Invoice[]) => items.filter((d) => d.id !== invoice.id && d.order.id === orderId);
  if (audience === "customer") return others((await myInvoices(undefined, orderId)).items);
  if (audience === "staff") return others((await staffInvoices({ orderId }, undefined, 50)).items);
  if (invoice.kind !== "credit_note" && !invoice.credited) return [];
  return others((await vendorInvoices({ orderId, business: invoice.business.id }, undefined, 50)).items);
}

/** What the document is, in a sentence, for the person looking at it. Same as the app. */
function kindNote(invoice: Invoice, audience: InvoiceAudience): string {
  const ruxstar = invoice.issuer === "ruxstar";
  if (invoice.kind === "credit_note") {
    if (audience === "customer") return "Credit note for your refund. It reduces the invoice below by the amount refunded.";
    if (isSeller(audience)) return "Credit note for a refund to the customer. It reduces the invoice below for your GST return.";
    return "Credit note for a refund. It reduces the invoice below.";
  }
  if (invoice.kind === "bill_of_supply") {
    if (invoice.seller.gstin) return "Bill of supply — no GST applies to this sale.";
    return ruxstar ? "Bill of supply — Ruxstar isn't GST registered yet, so there's no GST on it." : "Bill of supply — this business isn't GST registered, so there's no GST on it.";
  }
  if (invoice.role === "fee") return "Tax invoice for Ruxstar's platform fee, with GST.";
  if (ruxstar || invoice.operatorPays) return "Tax invoice from Ruxstar, which sells this on the business's behalf and pays the GST.";
  return "Tax invoice from the business, with GST. Ruxstar is shown as the e-commerce operator.";
}

/** CGST and SGST in the same state, IGST across states; with the rate when every line shares one. */
function taxRows(invoice: Invoice): { label: string; amount: number }[] {
  if (!invoice.totals.tax) return [];
  const rates = [...new Set(invoice.lines.filter((l) => l.rateBps > 0).map((l) => l.rateBps))];
  const rate = rates.length === 1 ? rates[0] : undefined;
  if (invoice.supply === "inter") return [{ label: rate ? `IGST ${percent(rate)}` : "IGST", amount: invoice.totals.igst }];
  const half = rate ? ` ${percent(rate / 2)}` : "";
  return [
    { label: `CGST${half}`, amount: invoice.totals.cgst },
    { label: `SGST${half}`, amount: invoice.totals.sgst },
  ];
}

const supplyLine = (invoice: Invoice) =>
  `${invoice.placeOfSupply ? `${invoice.placeOfSupply.state} (${invoice.placeOfSupply.code})` : "Not known"} · ${
    invoice.supply === "inter" ? "another state, so IGST" : "same state, so CGST + SGST"
  }`;

function orderLink(invoice: Invoice, audience: InvoiceAudience): { href: string; label: string } | null {
  const { type, id, orderNo } = invoice.order;
  if (audience === "customer") {
    if (type === "pod_order") return { href: `/orders/${id}`, label: "View order" };
    if (type === "gig_order") return { href: `/orders/freelance/${id}`, label: "View order" };
    return type === "coaching_order" ? { href: `/classes/${id}`, label: "View enrolment" } : { href: `/tickets/${id}`, label: "View booking" };
  }
  if (isSeller(audience) && type === "gig_order") return { href: `/freelance/orders/${id}`, label: "View order" };
  if (isSeller(audience)) return type === "pod_order" ? { href: `/vendor/orders/${id}`, label: "View order" } : null;
  if (type === "gig_order") return { href: `/admin/gig-orders/${id}`, label: "View order" };
  return { href: `/admin/invoices?orderNo=${orderNo}`, label: `Every document for order #${orderNo}` };
}

function Party({ title, party, children }: { title: string; party: Invoice["seller"]; children?: ReactNode }) {
  return (
    <section className={order.panel}>
      <h2 className={order.overline}>{title}</h2>
      <dl className={styles.facts}>
        <div>
          <dt>Name</dt>
          <dd>{party.legalName && party.legalName !== party.name ? `${party.name} (${party.legalName})` : party.name}</dd>
        </div>
        <div>
          <dt>GSTIN</dt>
          <dd>{party.gstin ?? "Not GST registered"}</dd>
        </div>
        {party.address && (
          <div>
            <dt>Address</dt>
            <dd>{party.address}</dd>
          </div>
        )}
        {party.state && (
          <div>
            <dt>State</dt>
            <dd>{party.stateCode ? `${party.state} (${party.stateCode})` : party.state}</dd>
          </div>
        )}
        {children}
      </dl>
    </section>
  );
}

function Lines({ invoice }: { invoice: Invoice }) {
  const { lines, supply } = invoice;
  const taxed = lines.some((l) => l.rateBps > 0);
  const discounted = lines.some((l) => l.discount > 0);
  return (
    <div className={styles.tableWrap} role="region" aria-label="Items" tabIndex={0}>
      <table className={styles.table}>
        <caption className="sr-only">{`Items on this ${INVOICE_KIND[invoice.kind].toLowerCase()}`}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className={styles.num}>
              Qty
            </th>
            <th scope="col" className={styles.num}>
              Price each
            </th>
            {discounted && (
              <th scope="col" className={styles.num}>
                Off from the seller
              </th>
            )}
            <th scope="col" className={styles.num}>
              {taxed ? "Before GST" : "Value"}
            </th>
            {taxed && (
              <th scope="col" className={styles.num}>
                GST
              </th>
            )}
            {taxed && supply === "intra" && (
              <>
                <th scope="col" className={styles.num}>
                  CGST
                </th>
                <th scope="col" className={styles.num}>
                  SGST
                </th>
              </>
            )}
            {taxed && supply === "inter" && (
              <th scope="col" className={styles.num}>
                IGST
              </th>
            )}
            <th scope="col" className={styles.num}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.description}-${i}`}>
              <th scope="row">
                {l.description}
                {l.code && <span className={styles.code}>{`${l.codeKind.toUpperCase()} ${l.code}`}</span>}
              </th>
              <td className={styles.num}>{l.quantity}</td>
              <td className={styles.num}>{money(l.unitPrice)}</td>
              {discounted && <td className={styles.num}>{l.discount ? `−${money(l.discount)}` : "—"}</td>}
              <td className={styles.num}>{money(l.taxable)}</td>
              {taxed && <td className={styles.num}>{l.rateBps ? percent(l.rateBps) : "No GST"}</td>}
              {taxed && supply === "intra" && (
                <>
                  <td className={styles.num}>{money(l.cgst)}</td>
                  <td className={styles.num}>{money(l.sgst)}</td>
                </>
              )}
              {taxed && supply === "inter" && <td className={styles.num}>{money(l.igst)}</td>}
              <td className={styles.num}>{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Totals({ invoice, audience }: { invoice: Invoice; audience: InvoiceAudience }) {
  const { totals } = invoice;
  return (
    <dl className={styles.totals}>
      {totals.tax > 0 && (
        <div>
          <dt>Taxable value</dt>
          <dd>{money(totals.taxable)}</dd>
        </div>
      )}
      {taxRows(invoice).map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{money(row.amount)}</dd>
        </div>
      ))}
      <div className={styles.grand}>
        <dt>{invoice.kind === "credit_note" ? "Total credited" : "Total"}</dt>
        <dd>{money(totals.total)}</dd>
      </div>
      {totals.ruxstarDiscount > 0 && (
        <>
          <div>
            <dt>Ruxstar discount (paid by Ruxstar)</dt>
            <dd>{`−${money(totals.ruxstarDiscount)}`}</dd>
          </div>
          <div className={styles.grand}>
            <dt>{audience === "customer" ? "You paid" : "Customer paid"}</dt>
            <dd>{money(totals.payable)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}

function Related({ title, docs, audience }: { title: string; docs: Invoice[]; audience: InvoiceAudience }) {
  if (!docs.length) return null;
  return (
    <section className={order.section}>
      <h2 className={order.overline}>{title}</h2>
      <ul className={order.rows}>
        {docs.map((d) => (
          <li key={d.id}>
            <Link href={invoiceHref(audience, d.id)} className={order.row}>
              <span className={order.rowIcon}>
                <Icon name="receipt" size={20} />
              </span>
              <span className={order.rowText}>
                <span className={order.rowTitle}>{refTitle(d)}</span>
                <span className={order.faint}>{[d.number, issuedOn(d.issuedAt), d.issuer === "ruxstar" ? "Ruxstar" : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={order.rowEnd}>{`${d.kind === "credit_note" ? "−" : ""}${money(d.totals.total)}`}</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InvoiceDocument({
  invoice,
  audience,
  related,
  onPdf,
  busy,
  error,
}: {
  invoice: Invoice;
  audience: InvoiceAudience;
  related: Invoice[];
  onPdf: (download: boolean) => void;
  busy: "open" | "download" | null;
  error: string | null;
}) {
  const link = orderLink(invoice, audience);
  const { tcs } = invoice;
  const operator = invoice.operator ? `${invoice.operator.name}${invoice.operator.gstin ? ` · ${invoice.operator.gstin}` : ""}` : null;

  return (
    <div className={order.page}>
      <Link href={INVOICE_HOME[audience]} className={styles.back}>
        <Icon name="arrow-left" size={16} />
        {HOME_LABEL[audience]}
      </Link>
      <div className={order.titleRow}>
        <div>
          <h1 className={order.title}>{INVOICE_KIND[invoice.kind]}</h1>
          <p className={styles.number}>{invoice.number}</p>
          <p className={order.small}>{`Issued ${issuedOn(invoice.issuedAt)} · FY ${invoice.fy}`}</p>
          <p className={order.small}>{`${invoice.business.name} · ${invoice.order.type === "event_order" ? "Booking" : invoice.order.type === "coaching_order" ? "Enrolment" : "Order"} #${invoice.order.orderNo}`}</p>
        </div>
        <Tag tone={KIND_TONE[invoice.kind]}>{`${invoice.kind === "credit_note" ? "−" : ""}${money(invoice.totals.total)}`}</Tag>
      </div>
      <div className={order.news}>
        <p className={order.small}>{kindNote(invoice, audience)}</p>
      </div>
      {invoice.against && (
        <p className={order.small}>
          {`Reduces invoice ${invoice.against.number} of ${issuedOn(invoice.against.issuedAt)}. `}
          <Link href={invoiceHref(audience, invoice.against.id)} className={styles.inline}>
            Open that invoice
          </Link>
        </p>
      )}
      {invoice.refund?.reason && <p className={order.small}>{`Refund reason: ${invoice.refund.reason}`}</p>}
      {invoice.credited > 0 && invoice.kind !== "credit_note" && <p className={order.small}>{`${money(invoice.credited)} of this has been credited back for refunds.`}</p>}

      <div className={order.actions}>
        <Button icon={<Icon name="download" size={18} />} loading={busy === "download"} disabled={busy !== null} onClick={() => onPdf(true)}>
          Download PDF
        </Button>
        <Button variant="secondary" loading={busy === "open"} disabled={busy !== null} onClick={() => onPdf(false)}>
          Open PDF
        </Button>
        {link && (
          <ButtonLink href={link.href} variant="ghost">
            {link.label}
          </ButtonLink>
        )}
      </div>
      {error && (
        <p className={order.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.parties}>
        <Party title="From" party={invoice.seller}>
          {operator && (
            <div>
              <dt>{invoice.operatorPays ? "E-commerce operator, which pays the GST" : "E-commerce operator"}</dt>
              <dd>{operator}</dd>
            </div>
          )}
        </Party>
        <Party title="To" party={invoice.buyer}>
          <div>
            <dt>Place of supply</dt>
            <dd>{supplyLine(invoice)}</dd>
          </div>
        </Party>
      </div>

      <section className={order.section}>
        <h2 className={order.overline}>{invoice.kind === "credit_note" ? "Credited" : "Items"}</h2>
        <Lines invoice={invoice} />
        <div className={order.panel}>
          <Totals invoice={invoice} audience={audience} />
        </div>
      </section>

      {tcs && audience !== "customer" && (
        <div className={order.news}>
          <strong>{`TCS ${percent(tcs.rateBps)}: ${money(tcs.amount)}`}</strong>
          <p className={order.small}>
            {isSeller(audience)
              ? "Tax collected at source: Ruxstar collects it on your sale as the e-commerce operator, for your GST return. It isn't taken from your payouts yet."
              : "Tax Ruxstar collects at source on the business's sale. It isn't taken from payouts yet."}
          </p>
        </div>
      )}

      {invoice.notes.length > 0 && (
        <ul className={styles.notes} aria-label="Notes">
          {invoice.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <Related title={isSeller(audience) && invoice.kind !== "credit_note" ? "Credit notes against it" : "Other documents for this order"} docs={related} audience={audience} />
    </div>
  );
}

/** One GST invoice, bill of supply or credit note, for a customer, a business or Ruxstar staff. The PDF opens from a short-lived signed link. Same as the app. */
export function InvoiceScreen({ id, audience }: { id: string; audience: InvoiceAudience }) {
  const onSignedOut = useOnSignedOut();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [related, setRelated] = useState<Invoice[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<"open" | "download" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fetchedAt = useRef(0);

  const load = useCallback(
    () =>
      LOAD[audience](id).then(
        (found) => {
          fetchedAt.current = Date.now();
          setInvoice(found);
          setError(null);
          return found;
        },
        (err: unknown) => {
          if (!onSignedOut(err)) setError(err);
          return null;
        },
      ),
    [audience, id, onSignedOut],
  );

  useEffect(() => {
    let live = true;
    void load().then((found) => {
      if (!found) return;
      relatedTo(found, audience).then(
        (docs) => live && setRelated(docs),
        () => undefined,
      );
    });
    return () => {
      live = false;
    };
  }, [load, audience]);

  const pdf = async (download: boolean) => {
    if (!invoice) return;
    setBusy(download ? "download" : "open");
    setPdfError(null);
    // Opened before any request so the browser does not block it as a pop-up.
    const tab = download ? null : window.open("", "_blank");
    try {
      let url = invoice.pdfUrl;
      if (Date.now() - fetchedAt.current > LINK_FRESH_MS) {
        const fresh = await LOAD[audience](id);
        fetchedAt.current = Date.now();
        setInvoice(fresh);
        url = fresh.pdfUrl;
      }
      const link = new URL(url);
      if (download) link.searchParams.set("download", "1");
      if (tab) tab.location.href = link.toString();
      else window.location.assign(link.toString());
    } catch (err) {
      tab?.close();
      if (!onSignedOut(err)) setPdfError(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  if (invoice) return <InvoiceDocument invoice={invoice} audience={audience} related={related} onPdf={(download) => void pdf(download)} busy={busy} error={pdfError} />;
  if (error) {
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Invoice not found" : "Could not load this invoice"}>
        <p>{formError(error).message}</p>
        {gone ? (
          <ButtonLink href={INVOICE_HOME[audience]} variant="secondary">
            {HOME_LABEL[audience]}
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
    <div className={order.page} aria-busy>
      <div className={shop.skeletonCard} />
    </div>
  );
}
