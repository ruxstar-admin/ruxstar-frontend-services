import { signedIn } from "./account";
import { api, API_URL, ApiError, unwrap, type ApiErrorBody } from "./client";
import type { paths } from "./schema";
import type { Page } from "./social";
import { money, OPTION_LABELS, type ShopProduct } from "./shops";

type Json<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": { data: infer D } } } };
}
  ? D
  : never;

export type Order = Json<"/v1/pod/orders/{id}", "get">;
export type OrderStatus = Order["status"];
export type Quote = Json<"/v1/pod/quote", "post">;
export type QuoteBody = paths["/v1/pod/quote"]["post"]["requestBody"]["content"]["application/json"];
export type OrderAddress = Order["address"];
export type PrintFile = Order["files"][number];
export type ShopOrder = Json<"/v1/vendor/orders/{id}", "get">;
export type ShopOrderView = NonNullable<NonNullable<paths["/v1/vendor/orders"]["get"]["parameters"]["query"]>["view"]>;
export type ShopStatus = paths["/v1/vendor/orders/{id}/status"]["post"]["requestBody"]["content"]["application/json"]["status"];
type CreateBody = paths["/v1/pod/orders"]["post"]["requestBody"]["content"]["application/json"];

export const PRINT_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const PRINT_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** The spec has no body for this route (it is the raw file), so it skips the typed client. */
async function postFile(file: File): Promise<PrintFile> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1/pod/files`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Client": "web", "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "The upload stopped. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => null)) as { data?: PrintFile; error?: ApiErrorBody } | null;
  if (response.ok && body?.data) return body.data;
  if (body?.error) throw new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.");
}

export const uploadPrintFile = (file: File) => signedIn(() => postFile(file));

export const quoteOrder = async (body: QuoteBody) => (await signedIn(() => unwrap(api.POST("/v1/pod/quote", { body })))).data;

export const placeOrder = async (body: CreateBody, idempotencyKey: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/pod/orders", { body, headers: { "Idempotency-Key": idempotencyKey } })))).data;

export const payOrder = async (id: string, returnTo: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/pod/orders/{id}/pay", { params: { path: { id } }, body: { returnTo } })))).data;

export const myOrders = async (cursor?: string): Promise<Page<Order>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/pod/orders", { params: { query: { cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

export const getOrder = async (id: string) => (await signedIn(() => unwrap(api.GET("/v1/pod/orders/{id}", { params: { path: { id } } })))).data;

export const cancelOrder = async (id: string) =>
  (await signedIn(() => unwrap(api.POST("/v1/pod/orders/{id}/cancel", { params: { path: { id } } })))).data;

export const orderFileLink = async (id: string, fileId: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/pod/orders/{id}/files/{fileId}", { params: { path: { id, fileId } } })))).data;

export const shopOrders = async (view: ShopOrderView, cursor?: string): Promise<Page<ShopOrder>> => {
  const envelope = await signedIn(() => unwrap(api.GET("/v1/vendor/orders", { params: { query: { view, cursor } } })));
  return { items: envelope.data, nextCursor: envelope.meta.nextCursor ?? null };
};

export const getShopOrder = async (id: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/vendor/orders/{id}", { params: { path: { id } } })))).data;

export const moveShopOrder = async (id: string, status: ShopStatus, reason: string | undefined, idempotencyKey: string) =>
  (
    await signedIn(() =>
      unwrap(
        api.POST("/v1/vendor/orders/{id}/status", {
          params: { path: { id } },
          headers: { "Idempotency-Key": idempotencyKey },
          body: reason ? { status, reason } : { status },
        }),
      ),
    )
  ).data;

export const shopOrderFileLink = async (id: string, fileId: string) =>
  (await signedIn(() => unwrap(api.GET("/v1/vendor/orders/{id}/files/{fileId}", { params: { path: { id, fileId } } })))).data;

// Words and lines, the same as the app.

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Waiting for payment",
  placed: "Waiting for the shop",
  accepted: "Accepted",
  printing: "Printing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Turned down",
  cancelled: "Cancelled",
};

export const SHOP_STATUS_LABEL: Record<OrderStatus, string> = { ...STATUS_LABEL, placed: "New", awaiting_payment: "Not paid" };

export const STATUS_TONE: Record<OrderStatus, "neutral" | "solid" | "success" | "warning" | "danger"> = {
  awaiting_payment: "warning",
  placed: "solid",
  accepted: "solid",
  printing: "solid",
  ready: "solid",
  out_for_delivery: "solid",
  delivered: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export const isFinished = (status: OrderStatus) => status === "delivered" || status === "rejected" || status === "cancelled";

const PATH: OrderStatus[] = ["placed", "accepted", "printing", "ready", "out_for_delivery", "delivered"];

/** Every step on the way, with when it happened. Skipped steps count as done. */
export function progressOf(order: Pick<Order, "status" | "timeline">) {
  const reached = PATH.indexOf(order.status);
  return PATH.map((status, i) => ({
    status,
    label: STATUS_LABEL[status],
    at: i <= reached ? order.timeline.find((t) => PATH.indexOf(t.status) >= i)?.at : undefined,
  }));
}

export function choiceLine(order: Pick<Order, "options" | "colour">) {
  const parts = Object.entries(order.options).map(([option, value]) => (option === "doubleSided" ? value : `${OPTION_LABELS[option] ?? option} ${value}`));
  if (order.colour) parts.push(order.colour === "bw" ? "Black & white" : "Colour");
  return parts.join(" · ");
}

export const quantityLine = (order: Pick<Order, "pricing" | "quantity" | "productLabel">) =>
  order.pricing === "per_page" ? `${order.quantity} ${order.quantity === 1 ? "copy" : "copies"}` : `${order.productLabel} × ${order.quantity}`;

type Price = Pick<Quote, "units" | "unitPrice" | "extrasPerUnit" | "platformFee">;

export function priceLines(price: Price, pricing: "per_unit" | "per_page") {
  const unit = pricing === "per_page" ? (price.units === 1 ? "page" : "pages") : price.units === 1 ? "piece" : "pieces";
  const lines = [{ label: `${price.units} ${unit} × ${money(price.unitPrice)}`, amount: price.units * price.unitPrice }];
  if (price.extrasPerUnit) lines.push({ label: `Extras, ${money(price.extrasPerUnit)} each`, amount: price.units * price.extrasPerUnit });
  if (price.platformFee) lines.push({ label: "Platform fee", amount: price.platformFee });
  return lines;
}

/** Size, or paper size for documents: an order can't be priced without it. */
export const requiredOption = (product: ShopProduct) => (product.pricing === "per_page" ? "paperSize" : "size");

export function nextSteps(status: OrderStatus): ShopStatus[] {
  switch (status) {
    case "placed":
      return ["accepted", "rejected"];
    case "accepted":
      return ["printing", "ready"];
    case "printing":
      return ["ready"];
    case "ready":
      return ["out_for_delivery", "delivered"];
    case "out_for_delivery":
      return ["delivered"];
    default:
      return [];
  }
}

export const STEP_ACTION: Record<ShopStatus, string> = {
  accepted: "Accept order",
  rejected: "Turn down",
  printing: "Start printing",
  ready: "Mark ready",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
};

export const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
