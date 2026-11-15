import { signedIn } from "./account";
import { API_URL, ApiError, type ApiErrorBody } from "./client";
import type { MyReview, Review } from "./reviews";
import type { Page } from "./social";
import type {
  AssignChoice,
  BannedCategory,
  ConsoleOrder,
  ConsoleOrderFilters,
  ConsoleProduct,
  ConsoleStore,
  ConsoleStoreDetail,
  DeliveryOptions,
  DeskOrder,
  DeskOrdersView,
  DeskStore,
  MoveTo,
  MyOrdersView,
  Placed,
  PlaceInput,
  ProductCard,
  ProductDetail,
  ProductFilters,
  ProductInput,
  ProductPatch,
  ProductStatus,
  Quote,
  QuoteInput,
  ReturnInput,
  StoreCard,
  StoreDetail,
  StoreFilters,
  StoreOrder,
  StoreRulesView,
  StoreSetupInput,
  StoreSetupView,
  VendorProduct,
  VendorProductFilters,
} from "./store-types";

export type * from "./store-types";

type Query = Record<string, string | number | boolean | undefined>;
interface Call {
  query?: Query;
  body?: unknown;
  /** The raw file, sent as its own content type. */
  file?: Blob;
  key?: string;
}

/** A small typed fetch with the same headers, cookies and errors as `api`, which also sends the raw product photo. */
async function call<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, { query, body, file, key }: Call = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) if (value !== undefined && value !== "") search.set(name, String(value));
  const headers: Record<string, string> = { "X-Client": "web" };
  if (key) headers["Idempotency-Key"] = key;
  if (file) headers["Content-Type"] = file.type;
  else if (body !== undefined) headers["Content-Type"] = "application/json";
  const qs = search.toString();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ""}`, {
      method,
      credentials: "include",
      headers,
      body: file ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }
  const parsed = (await response.json().catch(() => null)) as (T & { error?: ApiErrorBody }) | null;
  const requestId = response.headers.get("x-request-id");
  if (response.ok && parsed) return parsed;
  if (parsed?.error) throw new ApiError(response.status, parsed.error.code, parsed.error.message, parsed.error.details, requestId);
  throw new ApiError(response.status, "INTERNAL", "Something went wrong on our side.", [], requestId);
}

const one = async <T>(method: Parameters<typeof call>[0], path: string, options?: Call) =>
  (await signedIn(() => call<{ data: T }>(method, path, options))).data;
const list = async <T>(path: string, query?: Query): Promise<Page<T>> => {
  const envelope = await signedIn(() => call<{ data: T[]; meta: { nextCursor?: string | null } }>("GET", path, { query }));
  return { items: envelope.data, nextCursor: envelope.meta?.nextCursor ?? null };
};
const enc = encodeURIComponent;
const isId = (id: string) => /^[a-f0-9]{24}$/.test(id);

/** For the server: a public read cached for a minute like the page. Null when it isn't there; the page then loads it in the browser. */
async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return ((await res.json()) as { data: T }).data;
  } catch {
    return null;
  }
}

// Finding shops and products. These work signed out too.

export const storeRules = () => one<StoreRulesView>("GET", "/v1/shop/rules");

export const listStores = (filters: StoreFilters, cursor?: string) => list<StoreCard>("/v1/shop/", { ...filters, cursor });

export const getStore = (id: string) => one<StoreDetail>("GET", `/v1/shop/${enc(id)}`);

export const fetchPublicStore = (id: string) => (isId(id) ? fetchPublic<StoreDetail>(`/v1/shop/${id}`) : Promise.resolve(null));

export const listProducts = (filters: ProductFilters, cursor?: string, limit?: number) => list<ProductCard>("/v1/shop/products", { ...filters, cursor, limit });

/** For the server: a shop's first products, cached for a minute like its page. */
export async function fetchPublicProducts(shopId: string, limit: number): Promise<Page<ProductCard> | null> {
  if (!isId(shopId)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/shop/products?shop=${shopId}&limit=${limit}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: ProductCard[]; meta: { nextCursor?: string | null } };
    return { items: body.data, nextCursor: body.meta?.nextCursor ?? null };
  } catch {
    return null;
  }
}

export const getProduct = (id: string) => one<ProductDetail>("GET", `/v1/shop/products/${enc(id)}`);

export async function fetchPublicProduct(id: string): Promise<ProductDetail | null> {
  if (!isId(id)) return null;
  const product = await fetchPublic<ProductDetail>(`/v1/shop/products/${id}`);
  return product?.status === "live" ? product : null;
}

export const productReviews = (id: string, cursor?: string, limit?: number) => list<Review>(`/v1/shop/products/${enc(id)}/reviews`, { cursor, limit });

/** For the server: a product's first reviews, cached for a minute like the page. */
export async function fetchProductReviews(id: string, limit: number): Promise<Page<Review> | null> {
  if (!isId(id)) return null;
  try {
    const res = await fetch(`${API_URL}/v1/shop/products/${id}/reviews?limit=${limit}`, { headers: { "X-Client": "web" }, next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: Review[]; meta: { nextCursor?: string | null } };
    return { items: body.data, nextCursor: body.meta?.nextCursor ?? null };
  } catch {
    return null;
  }
}

// The cart and ordering.

/** Prices the cart as it is now; nothing is held. A sold-out line is an error naming it. */
export const quoteCart = (shopId: string, body: QuoteInput) => one<Quote>("POST", `/v1/shop/${enc(shopId)}/quote`, { body });

/** Pass the same key when retrying the same click. */
export const placeStoreOrder = (shopId: string, body: PlaceInput, key: string) => one<Placed>("POST", `/v1/shop/${enc(shopId)}/orders`, { body, key });

// Your orders.

export const myStoreOrders = (view: MyOrdersView, cursor?: string) => list<StoreOrder>("/v1/shop/orders", { view, cursor });

export const getStoreOrder = (id: string) => one<StoreOrder>("GET", `/v1/shop/orders/${enc(id)}`);

export const payStoreOrder = (id: string, returnTo: string) => one<{ checkoutUrl: string }>("POST", `/v1/shop/orders/${enc(id)}/pay`, { body: { returnTo } });

/** Before the shop packs it: everything back. */
export const cancelStoreOrder = (id: string, reason: string | undefined, key: string) =>
  one<StoreOrder>("POST", `/v1/shop/orders/${enc(id)}/cancel`, { body: reason ? { reason } : {}, key });

export const returnStoreOrder = (id: string, body: ReturnInput, key: string) => one<StoreOrder>("POST", `/v1/shop/orders/${enc(id)}/return`, { body, key });

const reviewPath = (orderId: string, productId: string) => `/v1/shop/orders/${enc(orderId)}/products/${enc(productId)}/review`;

/** Null until the customer reviews it. */
export const myProductReview = (orderId: string, productId: string) => one<MyReview | null>("GET", reviewPath(orderId, productId));

export const writeProductReview = async (orderId: string, productId: string, body: { rating: number; text?: string | null }) =>
  (await one<MyReview>("PUT", reviewPath(orderId, productId), { body }))!;

export const deleteProductReview = async (orderId: string, productId: string) => {
  await one<{ done: true }>("DELETE", reviewPath(orderId, productId));
};

export const reportStoreReview = async (reviewId: string, body: { reason: string; note?: string }) => {
  await one<{ done: true }>("POST", `/v1/shop/reviews/${enc(reviewId)}/report`, { body });
};

// The owner's setup.

export const storeSetup = (businessId: string) => one<StoreSetupView>("GET", `/v1/vendor/businesses/${enc(businessId)}/shop`);

export const saveStoreSetup = (businessId: string, body: StoreSetupInput) => one<StoreSetupView>("PUT", `/v1/vendor/businesses/${enc(businessId)}/shop`, { body });

export const businessProducts = (businessId: string, filters: VendorProductFilters, cursor?: string) =>
  list<VendorProduct>(`/v1/vendor/businesses/${enc(businessId)}/products`, { ...filters, cursor });

export const createProduct = (businessId: string, body: ProductInput, key: string) =>
  one<VendorProduct>("POST", `/v1/vendor/businesses/${enc(businessId)}/products`, { body, key });

export const vendorProduct = (id: string) => one<VendorProduct>("GET", `/v1/vendor/products/${enc(id)}`);

export const deleteProduct = (id: string) => one<{ done: true }>("DELETE", `/v1/vendor/products/${enc(id)}`);

/** JPEG, PNG or WebP up to 8 MB. One per product; a new one replaces it. */
export const setProductPhoto = (id: string, file: Blob) => one<VendorProduct>("PUT", `/v1/vendor/products/${enc(id)}/photo`, { file });

export const removeProductPhoto = (id: string) => one<VendorProduct>("DELETE", `/v1/vendor/products/${enc(id)}/photo`);

// The desk: the owner, and team members with store permissions.

export const deskStores = async () => (await list<DeskStore>("/v1/shop/desk/stores")).items;

export const deskOrders = (shopId: string, view: DeskOrdersView, cursor?: string) => list<DeskOrder>(`/v1/shop/desk/stores/${enc(shopId)}/orders`, { view, cursor });

export const deskOrder = (id: string) => one<DeskOrder>("GET", `/v1/shop/desk/orders/${enc(id)}`);

export const moveDeskOrder = (id: string, status: MoveTo, key: string) => one<DeskOrder>("POST", `/v1/shop/desk/orders/${enc(id)}/move`, { body: { status }, key });

/** The customer gets everything back and the stock goes back. */
export const cancelDeskOrder = (id: string, reason: string, key: string) => one<DeskOrder>("POST", `/v1/shop/desk/orders/${enc(id)}/cancel`, { body: { reason }, key });

export const deskDeliveryOptions = (id: string) => one<DeliveryOptions>("GET", `/v1/shop/desk/orders/${enc(id)}/delivery`);

export const assignDeskDelivery = (id: string, choice: AssignChoice, key: string) => one<DeskOrder>("POST", `/v1/shop/desk/orders/${enc(id)}/delivery`, { body: choice, key });

/** Before the rider picks it up; the order stays packed. */
export const cancelDeskDelivery = (id: string) => one<DeskOrder>("DELETE", `/v1/shop/desk/orders/${enc(id)}/delivery`);

/** Turning it down needs a note the customer reads. */
export const decideDeskReturn = (id: string, body: { decision: "approve" | "reject"; note?: string }, key: string) =>
  one<DeskOrder>("POST", `/v1/shop/desk/orders/${enc(id)}/return/decide`, { body, key });

/** The items are back: the customer is refunded out of the shop's share. */
export const receivedDeskReturn = (id: string, note: string | undefined, key: string) =>
  one<DeskOrder>("POST", `/v1/shop/desk/orders/${enc(id)}/return/received`, { body: note ? { note } : {}, key });

export const deskProducts = (shopId: string, filters: VendorProductFilters, cursor?: string) =>
  list<VendorProduct>(`/v1/shop/desk/stores/${enc(shopId)}/products`, { ...filters, cursor });

export const deskUpdateProduct = (id: string, body: ProductPatch) => one<VendorProduct>("PATCH", `/v1/shop/desk/products/${enc(id)}`, { body });

/** Each variant sent is set to the number given. */
export const setDeskStock = (id: string, variants: { variantId: string; stock: number }[]) =>
  one<VendorProduct>("PUT", `/v1/shop/desk/products/${enc(id)}/stock`, { body: { variants } });

// The console.

export const consoleStores = (filters: { city?: string; q?: string }, cursor?: string) => list<ConsoleStore>("/v1/ruxstar/shop/stores", { ...filters, cursor });

export const consoleStore = (id: string) => one<ConsoleStoreDetail>("GET", `/v1/ruxstar/shop/stores/${enc(id)}`);

export const consoleProducts = (filters: { status?: ProductStatus; shop?: string; city?: string; q?: string }, cursor?: string) =>
  list<ConsoleProduct>("/v1/ruxstar/shop/products", { ...filters, cursor });

export const consoleProduct = (id: string) => one<ConsoleProduct>("GET", `/v1/ruxstar/shop/products/${enc(id)}`);

/** It leaves the listings for good; the shop is told the reason. */
export const takeDownProduct = (id: string, reason: string, key: string) => one<ConsoleProduct>("POST", `/v1/ruxstar/shop/products/${enc(id)}/take-down`, { body: { reason }, key });

export const bannedCategories = async () => (await list<BannedCategory>("/v1/ruxstar/shop/banned")).items;

export const createBanned = (body: { key: string; name: string; words: string[] }, key: string) => one<BannedCategory>("POST", "/v1/ruxstar/shop/banned", { body, key });

export const updateBanned = (bannedKey: string, body: { name?: string; words?: string[]; active?: boolean }) =>
  one<BannedCategory>("PATCH", `/v1/ruxstar/shop/banned/${enc(bannedKey)}`, { body });

export const consoleOrders = (filters: ConsoleOrderFilters, cursor?: string) => list<ConsoleOrder>("/v1/ruxstar/shop/orders", { ...filters, cursor });

export const consoleOrder = (id: string) => one<ConsoleOrder>("GET", `/v1/ruxstar/shop/orders/${enc(id)}`);

export const consoleCancelOrder = (id: string, reason: string, key: string) => one<ConsoleOrder>("POST", `/v1/ruxstar/shop/orders/${enc(id)}/cancel`, { body: { reason }, key });

/** refund: the items are back (or needn't be), pay the customer now. Both sides read the note. */
export const consoleDecideReturn = (id: string, body: { decision: "approve" | "reject" | "refund"; note: string }, key: string) =>
  one<ConsoleOrder>("POST", `/v1/ruxstar/shop/orders/${enc(id)}/return`, { body, key });
