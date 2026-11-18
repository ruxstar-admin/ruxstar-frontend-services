import type { TagTone } from "@/components/ui";
import type { InvoiceKind, InvoiceRef } from "@/lib/api/invoices";

/** `freelance` is a business owner's documents opened under Freelancing, for freelancers without the vendor portal; the API sees `vendor`. */
export type InvoiceAudience = "customer" | "vendor" | "freelance" | "staff";

/** The business owner reading their own sales documents. */
export const isSeller = (audience: InvoiceAudience) => audience === "vendor" || audience === "freelance";

export const INVOICE_KIND: Record<InvoiceKind, string> = {
  tax_invoice: "Tax invoice",
  bill_of_supply: "Bill of supply",
  credit_note: "Credit note",
};

export const KIND_TONE: Record<InvoiceKind, TagTone> = { tax_invoice: "success", bill_of_supply: "neutral", credit_note: "warning" };

/** Where each audience opens a document. */
export const INVOICE_HOME: Record<InvoiceAudience, string> = {
  customer: "/invoices",
  vendor: "/vendor/invoices",
  freelance: "/freelance/invoices",
  staff: "/admin/invoices",
};

export const invoiceHref = (audience: InvoiceAudience, id: string) => `${INVOICE_HOME[audience]}/${id}`;

/** "Tax invoice", or "Tax invoice · Ruxstar platform fee" for the platform fee's own document. */
export const refTitle = (ref: Pick<InvoiceRef, "kind" | "role">) => (ref.role === "fee" ? `${INVOICE_KIND[ref.kind]} · Ruxstar platform fee` : INVOICE_KIND[ref.kind]);

const dayYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** "15 Nov 2026", in India time like the documents. */
export const issuedOn = (iso: string) => dayYear.format(new Date(iso));

/** 1800 → "18%", 50 → "0.5%". */
export const percent = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
