import { money } from "@/lib/api/shops";
import type {
  ChosenOption,
  DeskOrder,
  MoveTo,
  OrderLine,
  Payout,
  ProductOption,
  ProductStatus,
  ReturnReason,
  StoreOrder,
  StoreOrderStatus,
  StoreSetup,
  Variant,
} from "@/lib/api/store-types";

/** Same words as the app. Local shops are the `shop` module; the website calls them stores in code to keep them apart from print shops. */

export const STORE_TYPE_LABEL: Record<string, string> = {
  clothing: "Clothing",
  electronics: "Electronics",
  grocery: "Grocery",
  gifts: "Gifts",
  bakery: "Bakery",
  general_store: "General store",
};
export const storeTypeLabel = (type: string) => STORE_TYPE_LABEL[type] ?? "Shop";

export const STATUS: Record<StoreOrderStatus, { label: string; tone: "neutral" | "solid" | "success" | "warning" | "danger" }> = {
  awaiting_payment: { label: "Waiting for payment", tone: "warning" },
  paid: { label: "Waiting for the shop", tone: "solid" },
  accepted: { label: "Accepted", tone: "solid" },
  packed: { label: "Packed", tone: "solid" },
  out_for_delivery: { label: "Out for delivery", tone: "solid" },
  ready_for_pickup: { label: "Ready for pickup", tone: "solid" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
/** The shop's words for the same steps. */
export const DESK_STATUS: Record<StoreOrderStatus, { label: string; tone: "neutral" | "solid" | "success" | "warning" | "danger" }> = {
  ...STATUS,
  awaiting_payment: { label: "Not paid", tone: "warning" },
  paid: { label: "New", tone: "warning" },
};

export const MOVE_ACTION: Record<MoveTo, string> = {
  accepted: "Accept order",
  packed: "Mark packed",
  out_for_delivery: "Out for delivery",
  ready_for_pickup: "Ready for pickup",
  delivered: "Mark delivered",
};
/** For pickup orders, "delivered" is handing it over at the counter. */
export const moveAction = (to: MoveTo, method: "delivery" | "pickup") => (to === "delivered" && method === "pickup" ? "Picked up" : MOVE_ACTION[to]);
export const isMove = (s: StoreOrderStatus): s is MoveTo => s === "accepted" || s === "packed" || s === "out_for_delivery" || s === "ready_for_pickup" || s === "delivered";

export const RETURN_REASON: Record<ReturnReason, string> = {
  wrong_item: "Wrong item sent",
  damaged: "Arrived damaged",
  not_as_described: "Not as described",
  changed_mind: "Changed my mind",
  other: "Something else",
};
export const RETURN_REASONS = Object.keys(RETURN_REASON) as ReturnReason[];
/** The shop pays the trip back for these; otherwise one delivery fee comes off the refund. */
export const shopPaysTrip = (reason: ReturnReason) => reason === "wrong_item" || reason === "damaged";

export const RETURN_STATUS = {
  requested: { label: "Return asked", tone: "warning" },
  approved: { label: "Return accepted", tone: "solid" },
  rejected: { label: "Return turned down", tone: "danger" },
  refunded: { label: "Refunded", tone: "success" },
} as const;

export const PAYOUT_LABEL: Record<Payout, string> = {
  none: "Nothing to pay out",
  waiting: "Paid out after the return window",
  return: "On hold: a return is open",
  released: "Paid out",
};

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: "neutral" | "success" | "danger" }> = {
  live: { label: "On sale", tone: "success" },
  hidden: { label: "Off sale", tone: "neutral" },
  removed: { label: "Taken down", tone: "danger" },
};

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** "₹499", with the MRP struck when it is higher. */
export const discountPercent = (price: number, mrp: number | null) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

/** "Only 2 left" for 1–3, "Sold out" at 0, nothing otherwise. */
export const LOW_STOCK = 3;
export const stockLine = (stock: number) => (stock <= 0 ? "Sold out" : stock <= LOW_STOCK ? `Only ${stock} left` : null);

/** "Size M · Colour Blue". */
export const optionsText = (options: ChosenOption[]) => options.map((o) => `${o.name} ${o.value}`).join(" · ");

export const variantOptions = (options: ProductOption[], variant: Pick<Variant, "values">): ChosenOption[] =>
  options.map((o, i) => ({ name: o.name, value: variant.values[i] ?? "" }));

export const variantKey = (values: readonly string[]) => values.join("\u0000");

export const findVariant = (variants: Variant[], values: readonly (string | null)[]) =>
  values.some((v) => v === null) ? undefined : variants.find((v) => variantKey(v.values) === variantKey(values as string[]));

/**
 * Whether `value` of option `index` can be picked, given what is picked on the other options: some variant with that value,
 * matching the others where they're picked, has stock.
 */
export function valueInStock(variants: Variant[], picked: readonly (string | null)[], index: number, value: string): boolean {
  return variants.some((v) => v.stock > 0 && v.values[index] === value && picked.every((p, i) => i === index || p === null || v.values[i] === p));
}
/** Sold at all, in stock or not. */
export const valueSold = (variants: Variant[], picked: readonly (string | null)[], index: number, value: string) =>
  variants.some((v) => v.values[index] === value && picked.every((p, i) => i === index || p === null || v.values[i] === p));

/** "Delivery · Pickup", what a shop offers. */
export function methodsLine(s: { delivery: boolean; pickup: boolean }): string {
  if (s.delivery && s.pickup) return "Delivery or pickup";
  return s.delivery ? "Delivery" : s.pickup ? "Pickup only" : "Not taking orders";
}

/** "Free delivery", "₹40 delivery", "₹30 + ₹8 a km after 2 km". */
export function feeLine(fee: StoreSetup["deliveryFee"]): string {
  if (!fee.base && !fee.perKm) return "Free delivery";
  if (!fee.perKm) return `${money(fee.base)} delivery`;
  const after = fee.includedKm ? ` after ${fee.includedKm} km` : "";
  return `${fee.base ? `${money(fee.base)} + ` : ""}${money(fee.perKm)} a km${after}`;
}

export function deliveryAreaLine(setup: StoreSetup, city: string): string {
  return setup.radiusKm ? `Within ${setup.radiusKm} km in ${city}` : `Anywhere in ${city}`;
}

const DAY_MS = 24 * 60 * 60_000;
export const momentText = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
/** "in 2 days", "in 5 hours", for the return window. */
export function leftText(until: string, now = Date.now()): string {
  const ms = Date.parse(until) - now;
  if (ms <= 0) return "closed";
  if (ms >= DAY_MS) return `${plural(Math.floor(ms / DAY_MS), "day")} left`;
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `${plural(hours, "hour")} left` : "under an hour left";
}

export function directionsUrl(place: { name: string; address: string; point: { lat: number; lng: number } | null }) {
  const query = place.point ? `${place.point.lat},${place.point.lng}` : `${place.name}, ${place.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const itemsText = (lines: Pick<OrderLine, "quantity">[]) => plural(lines.reduce((s, l) => s + l.quantity, 0), "item");
/** "Kurta · Size M" for one line; "Kurta and 2 more" for several. */
export function linesTitle(lines: Pick<OrderLine, "title">[]): string {
  if (!lines.length) return "Order";
  return lines.length === 1 ? lines[0]!.title : `${lines[0]!.title} and ${lines.length - 1} more`;
}

export type StepState = "done" | "now" | "todo" | "problem";
export interface TimelineStep {
  title: string;
  detail?: string | null;
  state: StepState;
}

/** Where an order is: paid, accepted, packed, on its way or ready, delivered, and the return window after. */
export function orderTimeline(o: Pick<StoreOrder | DeskOrder, "status" | "method" | "timeline" | "deliveredAt" | "returnUntil" | "return" | "acceptBy">, forShop = false, now = Date.now()): TimelineStep[] {
  const at = (s: StoreOrderStatus) => o.timeline.find((t) => t.status === s)?.at ?? null;
  const pickup = o.method === "pickup";
  const path: StoreOrderStatus[] = ["paid", "accepted", "packed", pickup ? "ready_for_pickup" : "out_for_delivery", "delivered"];
  const reached = path.indexOf(o.status);
  const titles: Record<string, string> = {
    paid: "Paid",
    accepted: forShop ? "Accepted" : "The shop accepted it",
    packed: "Packed",
    out_for_delivery: "On its way",
    ready_for_pickup: "Ready to collect",
    delivered: pickup ? "Picked up" : "Delivered",
  };
  const steps: TimelineStep[] = path.map((s, i) => {
    const when = at(s);
    const done = i <= reached;
    const next = i === reached + 1;
    let detail: string | null = when ? momentText(when) : null;
    if (!done && next && s === "accepted" && o.acceptBy) detail = forShop ? `Accept by ${momentText(o.acceptBy)} or it’s refunded` : `The shop has until ${momentText(o.acceptBy)}`;
    return { title: titles[s]!, detail, state: done ? "done" : next ? "now" : "todo" };
  });
  if (o.status === "delivered" && o.returnUntil) {
    const open = Date.parse(o.returnUntil) > now;
    if (o.return) {
      const word = RETURN_STATUS[o.return.status];
      steps.push({ title: word.label, detail: momentText(o.return.decision?.at ?? o.return.requestedAt), state: o.return.status === "refunded" ? "done" : o.return.status === "rejected" ? "problem" : "now" });
    } else {
      steps.push({ title: open ? "Return window open" : "Return window closed", detail: open ? `Until ${momentText(o.returnUntil)}` : null, state: open ? "now" : "done" });
    }
  }
  return steps;
}

export function cancelledLine(o: Pick<StoreOrder, "cancellation">, forShop = false): string {
  const c = o.cancellation;
  if (!c) return "Cancelled";
  const by =
    c.by === "customer"
      ? forShop
        ? "Cancelled by the customer"
        : "You cancelled"
      : c.by === "vendor" || c.by === "staff"
        ? forShop
          ? "Cancelled by your shop"
          : "Cancelled by the shop"
        : c.by === "system"
          ? "Cancelled automatically"
          : "Cancelled by Ruxstar";
  return `${by} · ${momentText(c.at)}`;
}

/** The paise a price field holds, or null when it isn't a price. */
export function paiseOfText(text: string): number | null {
  const t = text.trim();
  if (!t || !/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const rupeesOf = (paise: number | null | undefined) => (paise == null ? "" : String(paise / 100));
