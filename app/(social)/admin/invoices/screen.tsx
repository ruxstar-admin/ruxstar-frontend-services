"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Needs, useCan } from "@/components/admin/AdminFrame";
import { Failed, Rows, styles } from "@/components/admin/parts";
import { useOnSignedOut } from "@/components/social/session";
import { usePages } from "@/components/social/use-pages";
import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { Button, Input } from "@/components/ui";
import { staffInvoices, type InvoiceKind, type StaffInvoiceFilter } from "@/lib/api/invoices";
import invoices from "@/components/invoices/invoices.module.css";

const KINDS: { value: InvoiceKind | ""; label: string }[] = [
  { value: "", label: "Every type" },
  { value: "tax_invoice", label: "Tax invoices" },
  { value: "bill_of_supply", label: "Bills of supply" },
  { value: "credit_note", label: "Credit notes" },
];
const PAGE_SIZE = 30;

/** Digits are an order number; anything else is a document number like INV/26-27/00001. */
function searchOf(text: string): Pick<StaffInvoiceFilter, "number" | "orderNo"> {
  const value = text.trim();
  if (!value) return {};
  if (/^\d{1,9}$/.test(value)) return { orderNo: Number(value) };
  return { number: value.toUpperCase().slice(0, 16) };
}

function List({ filter }: { filter: StaffInvoiceFilter }) {
  const onSignedOut = useOnSignedOut();
  const load = useCallback((cursor?: string) => staffInvoices(filter, cursor, PAGE_SIZE), [filter]);
  const { items, loading, loadingMore, hasMore, error, moreFailed, more, reload } = usePages(load);
  const searching = Boolean(filter.number || filter.orderNo || filter.business);

  useEffect(() => {
    if (error) onSignedOut(error);
  }, [error, onSignedOut]);

  if (loading) return <Rows />;
  if (error && items.length === 0) return <Failed error={error} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {filter.orderNo
          ? `No documents for order #${filter.orderNo}. Orders paid before invoicing started, and free orders, have none.`
          : filter.number
            ? `No document is numbered ${filter.number}. Check the number. Document numbers look like INV/26-27/00001.`
            : "No documents here. Invoices and credit notes show up here as orders are paid and refunded."}
      </p>
    );
  }
  return (
    <>
      <InvoiceTable items={items} audience="staff" caption={searching ? "Matching documents" : "Every document, newest first"} showBusiness />
      {moreFailed && <Failed error={error} onRetry={more} />}
      {hasMore && !moreFailed && (
        <div className={invoices.more}>
          <Button variant="secondary" loading={loadingMore} onClick={more}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

/** Every GST invoice, bill of supply and credit note, found by document or order number. Same as the app. */
export function InvoicesScreen({ initialOrderNo, business }: { initialOrderNo?: number; business?: string }) {
  const canSeeGst = useCan("modules.view");
  const [text, setText] = useState(initialOrderNo ? String(initialOrderNo) : "");
  const [search, setSearch] = useState(text);
  const [kind, setKind] = useState<InvoiceKind | "">("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const filter = useMemo<StaffInvoiceFilter>(() => ({ ...searchOf(search), ...(kind ? { kind } : {}), ...(business ? { business } : {}) }), [search, kind, business]);

  return (
    <Needs need="orders.view">
      <div className={styles.page}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>Invoices</h1>
            <p className={styles.muted}>Every GST document Ruxstar has issued, for businesses and for its own fee. Open one for its PDF.</p>
          </div>
          {canSeeGst && (
            <Link href="/admin/gst" className={styles.muted}>
              GST settings
            </Link>
          )}
        </div>
        <div className={styles.toolbar}>
          <Input
            label="Find a document"
            placeholder="Document number or order number"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 16))}
            autoComplete="off"
            spellCheck={false}
          />
          <select className={styles.select} aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as InvoiceKind | "")}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {business && <p className={styles.muted}>Showing one business&apos;s documents.</p>}
        <List key={JSON.stringify(filter)} filter={filter} />
      </div>
    </Needs>
  );
}
