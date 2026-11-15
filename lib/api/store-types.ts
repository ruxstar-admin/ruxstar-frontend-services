/**
 * Local shops' API shapes (the `shop` module), written from the backend's `src/modules/shop/contracts.ts`. Amounts are
 * paise; times are ISO strings. "Store" here keeps them apart from print shops, which the rest of the site calls shops.
 */

import type { InvoiceRef } from "./invoices";
import type { paths } from "./schema";

export interface Point {
  lat: number;
  lng: number;
}
export interface Rating {
  average: number | null;
  count: number;
}
export interface StorePhoto {
  url: string;
  width: number;
  height: number;
}
/** Such as Size with S, M, L, in the shop's order. */
export interface ProductOption {
  name: string;
  values: string[];
}
/** hidden: the shop took it off sale. removed: Ruxstar took it down. */
export type ProductStatus = "live" | "hidden" | "removed";
export interface DeliveryFee {
  base: number;
  includedKm: number;
  perKm: number;
}

export interface StoreRules {
  returnDays: number;
  maxOptions: number;
  releaseHours: number;
  holdMinutes: number;
  acceptHours: number;
  maxProducts: number;
  maxVariants: number;
  maxValues: number;
  maxLines: number;
  maxQuantity: number;
}
export interface StoreRulesView extends StoreRules {
  commissionBps: number;
  platformFee: number;
}

// Shops and products, as customers see them.

export interface StoreSetup {
  delivery: boolean;
  pickup: boolean;
  /** Road km it delivers to; null for anywhere in its city. */
  radiusKm: number | null;
  deliveryFee: DeliveryFee;
  minOrder: number;
  /** Takes returns within Ruxstar's return days; false is "No returns". */
  returns: boolean;
  notes: string | null;
}

export interface StoreCard {
  id: string;
  name: string;
  /** clothing, electronics, grocery, gifts, bakery or general_store. */
  type: string;
  photoUrl: string | null;
  city: string;
  area: string | null;
  open: boolean;
  delivery: boolean;
  pickup: boolean;
  returnRule: string;
  rating: Rating;
}
export interface StoreFilters {
  city?: string;
  type?: string;
  q?: string;
}
export interface StoreDetail extends StoreCard {
  description: string | null;
  photos: StorePhoto[];
  phone: string | null;
  address: string;
  point: Point | null;
  setup: StoreSetup;
  /** Days after delivery to ask for a return; null for no returns. */
  returnDays: number | null;
  canOrder: boolean;
  whyNot: string | null;
  /** Live products. */
  products: number;
}

export interface Variant {
  id: string;
  /** One per option, in the options' order; empty without options. */
  values: string[];
  price: number;
  /** The printed MRP, when given; at least the price. */
  mrp: number | null;
  stock: number;
  sku: string | null;
}
export interface ProductCard {
  id: string;
  title: string;
  photo: StorePhoto | null;
  business: { id: string; name: string };
  city: string;
  priceFrom: number;
  mrpFrom: number | null;
  inStock: boolean;
  rating: Rating;
}
export interface ProductFilters {
  city?: string;
  shop?: string;
  q?: string;
  inStock?: boolean;
}
export interface ProductDetail extends ProductCard {
  description: string | null;
  options: ProductOption[];
  /** One per combination sold; a combination missing here isn't sold. */
  variants: Variant[];
  status: ProductStatus;
  canOrder: boolean;
  whyNot: string | null;
  returnRule: string;
  delivery: boolean;
  pickup: boolean;
}

// The cart and checkout. The cart is kept on the device; these price it as it is now.

export interface CartLine {
  productId: string;
  variantId: string;
  quantity: number;
}
export type Method = "delivery" | "pickup";
export interface QuoteInput {
  lines: CartLine[];
  method: Method;
  address?: { line?: string; city?: string; pincode?: string; point?: Point | null };
  code?: string;
}
export interface ChosenOption {
  name: string;
  value: string;
}
export interface QuoteLine {
  productId: string;
  variantId: string;
  title: string;
  options: ChosenOption[];
  unitPrice: number;
  mrp: number | null;
  quantity: number;
  total: number;
  stock: number;
}
export interface CouponOffer {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
  terms: string | null;
  discount: number;
  problem: string | null;
}
export interface AppliedCoupon {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
}
export interface Quote {
  lines: QuoteLine[];
  items: number;
  delivery: number;
  deliveryKm: number | null;
  platformFee: number;
  discount: number;
  total: number;
  returnRule: string;
  offers: CouponOffer[];
  checked: { code: string; discount: number; problem: string | null } | null;
}
export interface DeliveryAddress {
  name: string;
  phone: string;
  line: string;
  city: string;
  pincode: string;
  point?: Point | null;
}
export interface PlaceInput {
  lines: CartLine[];
  method: Method;
  address?: DeliveryAddress;
  coupon?: string;
  note?: string;
  returnTo: string;
}

/** paid: waiting for the shop to accept. delivered also covers picked up from the shop. */
export type StoreOrderStatus = "awaiting_payment" | "paid" | "accepted" | "packed" | "out_for_delivery" | "ready_for_pickup" | "delivered" | "cancelled";
export type Actor = "customer" | "vendor" | "staff" | "system" | "rider";
/** wrong_item and damaged: the shop pays the trip back. Otherwise one delivery fee comes off the refund. */
export type ReturnReason = "wrong_item" | "damaged" | "not_as_described" | "changed_mind" | "other";
export interface ReturnInput {
  reason: ReturnReason;
  note?: string;
  /** What goes back; left out, everything. */
  lines?: { lineId: string; quantity: number }[];
}
export interface OrderLine {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  options: ChosenOption[];
  photoUrl: string | null;
  sku: string | null;
  unitPrice: number;
  mrp: number | null;
  quantity: number;
  total: number;
}
export interface OrderRefund {
  kind: "full" | "return";
  amount: number;
  reason: string | null;
  status: "pending" | "done";
  at: string;
}
/** requested and approved hold the shop's money until refunded or rejected. */
export type ReturnStatus = "requested" | "approved" | "rejected" | "refunded";
export interface OrderReturn {
  reason: ReturnReason;
  note: string | null;
  lines: { lineId: string; quantity: number }[];
  status: ReturnStatus;
  tripPaidBy: "shop" | "customer";
  /** Taken off the refund when the customer pays the trip back. */
  tripFee: number;
  /** What the customer gets back. */
  amount: number;
  requestedAt: string;
  decision: { by: Actor; note: string | null; at: string } | null;
  receivedAt: string | null;
}
export type TripStatus = "offered" | "accepted" | "picked_up" | "delivered" | "cancelled";
export interface Rider {
  name: string;
  avatarUrl: string | null;
  phone: string;
  vehicle: { type: "bike" | "scooter"; number: string };
}
interface DeliveryCore {
  carrier: "team" | "partner";
  status: TripStatus;
  rider: Rider | null;
}
export interface OrderAddressView {
  name: string;
  phone: string;
  line: string;
  city: string;
  pincode: string;
  point: Point | null;
}

interface OrderFields {
  id: string;
  orderNo: number;
  status: StoreOrderStatus;
  business: { id: string; name: string };
  lines: OrderLine[];
  method: Method;
  /** Null for pickup. */
  address: OrderAddressView | null;
  /** Pickup: where to collect it. */
  pickupAt: { address: string; point: Point | null; phone: string | null } | null;
  price: { items: number; delivery: number; deliveryKm: number | null; platformFee: number; discount: number; total: number };
  coupon: AppliedCoupon | null;
  note: string | null;
  timeline: { status: StoreOrderStatus; at: string; by: Actor }[];
  payBy: string | null;
  paidAt: string | null;
  /** Paid: refunded if the shop hasn't accepted by then. */
  acceptBy: string | null;
  deliveredAt: string | null;
  returnRule: string;
  returnUntil: string | null;
  return: OrderReturn | null;
  refunds: OrderRefund[];
  refunded: number;
  cancellation: { by: Actor; reason: string; at: string } | null;
  invoices?: InvoiceRef[];
  createdAt: string;
}
export interface ReviewableProduct {
  productId: string;
  title: string;
  canReview: boolean;
  reviewUntil: string | null;
}
export interface StoreOrder extends OrderFields {
  /** Null while the shop delivers it itself. */
  delivery: (DeliveryCore & { dropCode: string | null }) | null;
  /** Unpaid, or paid and not packed yet: a full refund. */
  canCancel: boolean;
  /** Delivered, the shop takes returns and the window is open. */
  canReturn: boolean;
  reviewable: ReviewableProduct[];
  canReview?: boolean;
  reviewUntil?: string | null;
}
export interface Placed {
  order: StoreOrder;
  checkoutUrl: string;
}
export type MyOrdersView = "current" | "past" | "all";

// The desk: the owner and their team.

/** waiting: until the return window and the hold are over. return: a return is open. */
export type Payout = "none" | "waiting" | "return" | "released";
export interface DeskOrder extends OrderFields {
  customer: { name: string; phone: string | null };
  /** Null while you deliver it yourself. */
  delivery: (DeliveryCore & { jobId: string; pay: number; offerUntil: string | null }) | null;
  commission: number;
  vendorShare: number;
  payout: Payout;
  releaseAt: string | null;
  /** The steps you can move it to now. */
  next: StoreOrderStatus[];
  /** Paid and not delivered; always a full refund. */
  canCancel: boolean;
}
export type DeskOrdersView = "open" | "returns" | "done" | "all";
export type MoveTo = "accepted" | "packed" | "out_for_delivery" | "ready_for_pickup" | "delivered";
export interface DeskStore {
  id: string;
  name: string;
  owner: boolean;
  /** The owner has every one. */
  permissions: string[];
  /** Orders paid and not delivered. */
  open: number;
  /** Returns open. */
  returns: number;
}
export interface DeliveryOptions {
  orderStatus: string;
  canAssign: boolean;
  reason: string | null;
  team: { placeId: string; name: string; avatarUrl: string | null; vehicle: { type: "bike" | "scooter"; number: string } | null; ready: boolean }[];
  partner: { available: boolean; reason: string | null; pay: number; distanceKm: number | null; online: number };
}
export type AssignChoice = { carrier: "team"; placeId: string } | { carrier: "partner" };

// The owner's setup: shop settings and products.

export interface StoreSetupInput {
  delivery?: boolean;
  pickup?: boolean;
  radiusKm?: number | null;
  deliveryFee?: DeliveryFee;
  minOrder?: number;
  returns?: boolean;
  notes?: string | null;
}
export interface StoreSetupView extends StoreSetup {
  /** Ruxstar's return days, when returns are on. */
  returnDays: number;
}
export interface VariantInput {
  values?: string[];
  price: number;
  mrp?: number | null;
  stock: number;
  sku?: string | null;
}
export interface ProductInput {
  title: string;
  description?: string | null;
  options?: ProductOption[];
  variants: VariantInput[];
  hsn?: string | null;
  gstRateBps?: number | null;
  status?: "live" | "hidden";
}
export type ProductPatch = Partial<ProductInput>;
export interface VendorProduct extends ProductDetail {
  hsn: string | null;
  gstRateBps: number | null;
  removal: { reason: string; at: string } | null;
  createdAt: string;
  updatedAt: string;
}
export interface VendorProductFilters {
  status?: ProductStatus;
  q?: string;
  lowStock?: number;
}

// The console.

export interface ConsoleStore extends StoreCard {
  ownerId: string;
  status: string;
  suspended: boolean;
  products: number;
  orders: number;
  createdAt: string;
}
export interface ConsoleStoreDetail {
  store: ConsoleStore;
  setup: StoreSetup | null;
  openOrders: number;
  openReturns: number;
}
export interface ConsoleProduct extends VendorProduct {
  vendorId: string;
}
export interface BannedCategory {
  key: string;
  name: string;
  words: string[];
  active: boolean;
  updatedAt: string;
}
export interface ConsoleOrder extends DeskOrder {
  customerId: string;
  vendorId: string;
  releasedAt: string | null;
}
export interface ConsoleOrderFilters {
  shop?: string;
  status?: StoreOrderStatus;
  returns?: "open" | "rejected";
}

type Ok<R> = R extends { responses: infer Rs } ? Rs[keyof Rs & (200 | 201)] : never;
type Data<R> = Ok<R> extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<R> = R extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
type Query<R> = R extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;
type Item<T> = T extends readonly (infer I)[] ? I : T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** Each line stops compiling when the backend changes that shape; `npm run api:types` then shows what moved. */
export type ContractChecks = [
  Assert<Same<StoreRulesView, Data<paths["/v1/shop/rules"]["get"]>>>,
  Assert<Same<StoreCard, Item<Data<paths["/v1/shop/"]["get"]>>>>,
  Assert<Same<StoreFilters, Omit<Query<paths["/v1/shop/"]["get"]>, "cursor" | "limit">>>,
  Assert<Same<StoreDetail, Data<paths["/v1/shop/{id}"]["get"]>>>,
  Assert<Same<ProductCard, Item<Data<paths["/v1/shop/products"]["get"]>>>>,
  Assert<Same<ProductFilters, Omit<Query<paths["/v1/shop/products"]["get"]>, "cursor" | "limit">>>,
  Assert<Same<ProductDetail, Data<paths["/v1/shop/products/{id}"]["get"]>>>,
  Assert<Same<QuoteInput, Body<paths["/v1/shop/{id}/quote"]["post"]>>>,
  Assert<Same<Quote, Data<paths["/v1/shop/{id}/quote"]["post"]>>>,
  Assert<Same<PlaceInput, Body<paths["/v1/shop/{id}/orders"]["post"]>>>,
  Assert<Same<Placed, Data<paths["/v1/shop/{id}/orders"]["post"]>>>,
  Assert<Same<StoreOrder, Item<Data<paths["/v1/shop/orders"]["get"]>>>>,
  Assert<Same<StoreOrder, Data<paths["/v1/shop/orders/{id}"]["get"]>>>,
  Assert<Same<StoreOrder, Data<paths["/v1/shop/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<StoreOrder, Data<paths["/v1/shop/orders/{id}/return"]["post"]>>>,
  Assert<Same<ReturnInput, Body<paths["/v1/shop/orders/{id}/return"]["post"]>>>,
  Assert<Same<{ checkoutUrl: string }, Data<paths["/v1/shop/orders/{id}/pay"]["post"]>>>,
  Assert<Same<DeskStore, Item<Data<paths["/v1/shop/desk/stores"]["get"]>>>>,
  Assert<Same<DeskOrder, Item<Data<paths["/v1/shop/desk/stores/{id}/orders"]["get"]>>>>,
  Assert<Same<DeskOrder, Data<paths["/v1/shop/desk/orders/{id}"]["get"]>>>,
  Assert<Same<DeskOrder, Data<paths["/v1/shop/desk/orders/{id}/move"]["post"]>>>,
  Assert<Same<DeskOrder, Data<paths["/v1/shop/desk/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<DeskOrder, Data<paths["/v1/shop/desk/orders/{id}/return/decide"]["post"]>>>,
  Assert<Same<DeskOrder, Data<paths["/v1/shop/desk/orders/{id}/return/received"]["post"]>>>,
  Assert<Same<DeliveryOptions, Data<paths["/v1/shop/desk/orders/{id}/delivery"]["get"]>>>,
  Assert<Same<AssignChoice, Body<paths["/v1/shop/desk/orders/{id}/delivery"]["post"]>>>,
  Assert<Same<VendorProduct, Item<Data<paths["/v1/shop/desk/stores/{id}/products"]["get"]>>>>,
  Assert<Same<VendorProductFilters, Omit<Query<paths["/v1/shop/desk/stores/{id}/products"]["get"]>, "cursor" | "limit">>>,
  Assert<Same<VendorProduct, Data<paths["/v1/shop/desk/products/{id}"]["patch"]>>>,
  Assert<Same<ProductPatch, Body<paths["/v1/shop/desk/products/{id}"]["patch"]>>>,
  Assert<Same<VendorProduct, Data<paths["/v1/shop/desk/products/{id}/stock"]["put"]>>>,
  Assert<Same<StoreSetupView, Data<paths["/v1/vendor/businesses/{id}/shop"]["get"]>>>,
  Assert<Same<StoreSetupInput, Body<paths["/v1/vendor/businesses/{id}/shop"]["put"]>>>,
  Assert<Same<VendorProduct, Item<Data<paths["/v1/vendor/businesses/{id}/products"]["get"]>>>>,
  Assert<Same<VendorProduct, Data<paths["/v1/vendor/businesses/{id}/products"]["post"]>>>,
  Assert<Same<ProductInput, Body<paths["/v1/vendor/businesses/{id}/products"]["post"]>>>,
  Assert<Same<VendorProduct, Data<paths["/v1/vendor/products/{id}"]["get"]>>>,
  Assert<Same<VendorProduct, Data<paths["/v1/vendor/products/{id}"]["patch"]>>>,
  Assert<Same<VendorProduct, Data<paths["/v1/vendor/products/{id}/photo"]["put"]>>>,
  Assert<Same<ConsoleStore, Item<Data<paths["/v1/ruxstar/shop/stores"]["get"]>>>>,
  Assert<Same<ConsoleStoreDetail, Data<paths["/v1/ruxstar/shop/stores/{id}"]["get"]>>>,
  Assert<Same<ConsoleProduct, Item<Data<paths["/v1/ruxstar/shop/products"]["get"]>>>>,
  Assert<Same<ConsoleProduct, Data<paths["/v1/ruxstar/shop/products/{id}"]["get"]>>>,
  Assert<Same<BannedCategory, Item<Data<paths["/v1/ruxstar/shop/banned"]["get"]>>>>,
  Assert<Same<BannedCategory, Data<paths["/v1/ruxstar/shop/banned"]["post"]>>>,
  Assert<Same<BannedCategory, Data<paths["/v1/ruxstar/shop/banned/{key}"]["patch"]>>>,
  Assert<Same<ConsoleOrder, Item<Data<paths["/v1/ruxstar/shop/orders"]["get"]>>>>,
  Assert<Same<ConsoleOrderFilters, Omit<Query<paths["/v1/ruxstar/shop/orders"]["get"]>, "cursor" | "limit">>>,
  Assert<Same<ConsoleOrder, Data<paths["/v1/ruxstar/shop/orders/{id}"]["get"]>>>,
  Assert<Same<ConsoleOrder, Data<paths["/v1/ruxstar/shop/orders/{id}/return"]["post"]>>>,
  Assert<Same<StoreRules, NonNullable<Item<Data<paths["/v1/ruxstar/modules"]["get"]>>["shopRules"]>>>,
];
