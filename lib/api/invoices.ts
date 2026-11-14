import { signedIn } from "./account";
import { api, newIdempotencyKey, unwrap } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer B } } };
}
  ? B
  : never;
type Query<P extends keyof paths> = paths[P] extends { get: { parameters: { query?: infer Q } } } ? NonNullable<Q> : never;
type Body<P extends keyof paths> = paths[P] extends { patch: { requestBody: { content: { "application/json": infer B } } } } ? B : never;

/** A tax invoice, bill of supply or credit note, as issued. Amounts are paise. */
export type Invoice = Json<"/v1/account/invoices/{id}", "get">["data"];
export type InvoiceKind = Invoice["kind"];
export type InvoiceLine = Invoice["lines"][number];
/** What an order or statement line shows about each of its documents. */
export type InvoiceRef = NonNullable<Json<"/v1/pod/orders/{id}", "get">["data"]["invoices"]>[number];
export type VendorInvoiceFilter = Omit<Query<"/v1/vendor/invoices">, "cursor" | "limit">;
export type StaffInvoiceFilter = Omit<Query<"/v1/ruxstar/invoices">, "cursor" | "limit">;
export type InvoiceExport = Query<"/v1/vendor/invoices/export">;
export type GstSettings = Json<"/v1/ruxstar/gst", "get">["data"];
export type GstModuleSettings = GstSettings["modules"][number];
export type GstModule = GstModuleSettings["module"];
export type GstSeller = GstSettings["seller"];
export type GstModulePatch = Body<"/v1/ruxstar/gst/modules/{module}">;
export type GstSellerPatch = Body<"/v1/ruxstar/gst/seller">;

const toPage = <T>(envelope: { data: T[]; meta: { nextCursor?: string | null } }): Page<T> => ({
  items: envelope.data,
  nextCursor: envelope.meta.nextCursor ?? null,
});
const byId = (id: string) => ({ params: { path: { id } } });
const keyed = (key: string) => ({ headers: { "Idempotency-Key": key } });

// Customers: their own documents at every business.

export const myInvoices = async (cursor?: string, orderId?: string) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/account/invoices", { params: { query: { cursor, ...(orderId ? { orderId, limit: 50 } : {}) } } }))));

export const myInvoice = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/account/invoices/{id}", byId(id))))).data;

// Vendors: documents issued in their businesses' names. Ruxstar's fee documents aren't included.

export const vendorInvoices = async (filter: VendorInvoiceFilter, cursor?: string, limit?: number) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/vendor/invoices", { params: { query: { ...filter, cursor, limit } } }))));

export const vendorInvoice = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/vendor/invoices/{id}", byId(id))))).data;

/** The CSV for GST returns: up to a year and 5,000 documents at a time. */
export const exportVendorInvoices = async (query: InvoiceExport) =>
  signedIn(() => unwrap(api.GET("/v1/vendor/invoices/export", { params: { query }, parseAs: "blob" })));

// The console.

export const staffInvoices = async (filter: StaffInvoiceFilter, cursor?: string, limit?: number) =>
  toPage(await signedIn(() => unwrap(api.GET("/v1/ruxstar/invoices", { params: { query: { ...filter, cursor, limit } } }))));

export const staffInvoice = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/invoices/{id}", byId(id))))).data;

export const gstSettings = async () => (await signedIn(() => unwrap(api.GET("/v1/ruxstar/gst")))).data;

/** Send only what changes. Applies to orders paid from then on. */
export const updateGstModule = async (module: GstModule, patch: GstModulePatch, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/ruxstar/gst/modules/{module}", { params: { path: { module } }, body: patch, ...keyed(key) })))).data;

/** Send only what changes; null clears the GSTIN or the address. */
export const updateGstSeller = async (patch: GstSellerPatch, key = newIdempotencyKey()) =>
  (await signedIn(() => unwrap(api.PATCH("/v1/ruxstar/gst/seller", { body: patch, ...keyed(key) })))).data;
