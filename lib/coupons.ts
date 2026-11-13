import type { CouponPatch, ManagedCoupon, NewCoupon } from "@/lib/api/admin";

type CouponState = ManagedCoupon["state"];
type CouponKind = ManagedCoupon["kind"];

/** Same words as the app. */
export const STATE: Record<CouponState, { label: string; tone: "neutral" | "success" | "warning" }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Starts later", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" },
  used_up: { label: "Used up", tone: "warning" },
  off: { label: "Off", tone: "neutral" },
};

/** A flat coupon takes at most ₹10,000 off, and a percent coupon's most-off is the same. */
export const MAX_OFF_RUPEES = 10_000;
export const MAX_USES = 1_000_000;
export const MAX_PER_CUSTOMER = 100;
const MAX_MIN_ORDER_RUPEES = 5_00_000;

export const cleanCode = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
export const cleanAmount = (text: string) => text.replace(/[^0-9.]/g, "").replace(/(\.\d{0,2}).*$/, "$1");
export const cleanCount = (text: string) => text.replace(/\D/g, "").slice(0, 7);

const paiseOf = (rupees: string) => Math.round(Number(rupees) * 100);
const rupeesOf = (paise: number) => String(paise / 100);

/** A day in India as `YYYY-MM-DD`. */
export const dayKeyOf = (iso: string) => new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10);
export const todayKey = () => dayKeyOf(new Date().toISOString());
/** A coupon starts at the beginning of its first day and ends at the end of its last, in India. */
export const startOf = (key: string) => `${key}T00:00:00+05:30`;
export const endOf = (key: string) => `${key}T23:59:59+05:30`;
export const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const usesLine = (c: Pick<ManagedCoupon, "used" | "limit">) => (c.limit !== null ? `${c.used} of ${c.limit} used` : `${c.used} used`);
export const perCustomerLine = (c: Pick<ManagedCoupon, "perCustomer">) =>
  c.perCustomer === null ? "No limit" : c.perCustomer === 1 ? "Once" : `${c.perCustomer} times`;

/** What the form holds, as typed. Empty dates mean "today" and "no end"; empty limits mean none. */
export interface CouponDraft {
  code: string;
  kind: CouponKind;
  value: string;
  cap: string;
  minOrder: string;
  starts: string;
  ends: string;
  limit: string;
  perCustomer: string;
  firstOrderOnly: boolean;
  listed: boolean;
  businessIds: string[];
}

export const emptyDraft = (): CouponDraft => ({
  code: "",
  kind: "percent",
  value: "",
  cap: "",
  minOrder: "",
  starts: "",
  ends: "",
  limit: "",
  perCustomer: "1",
  firstOrderOnly: false,
  listed: true,
  businessIds: [],
});

export const draftOf = (c: ManagedCoupon): CouponDraft => ({
  code: c.code,
  kind: c.kind,
  value: c.kind === "percent" ? String(c.value) : rupeesOf(c.value),
  cap: c.cap !== null ? rupeesOf(c.cap) : "",
  minOrder: c.minOrder ? rupeesOf(c.minOrder) : "",
  starts: c.startsAt ? dayKeyOf(c.startsAt) : "",
  ends: c.endsAt ? dayKeyOf(c.endsAt) : "",
  limit: c.limit !== null ? String(c.limit) : "",
  perCustomer: c.perCustomer !== null ? String(c.perCustomer) : "",
  firstOrderOnly: c.firstOrderOnly,
  listed: c.listed,
  businessIds: c.businesses.map((b) => b.id),
});

export type DraftErrors = Partial<Record<"code" | "value" | "cap" | "minOrder" | "starts" | "ends" | "limit" | "perCustomer" | "shops", string>>;

/** What's wrong with the draft, field by field. `creating` checks the code and discount, which can't change later. */
export function draftErrors(d: CouponDraft, { creating, needsShops, today }: { creating: boolean; needsShops: boolean; today: string }): DraftErrors {
  const errors: DraftErrors = {};
  const most = `From ₹1 to ₹${MAX_OFF_RUPEES.toLocaleString("en-IN")}`;
  if (creating) {
    if (!/^[A-Z0-9]{4,16}$/.test(d.code)) errors.code = "4 to 16 letters and digits";
    const value = Number(d.value);
    if (d.kind === "percent" && !(Number.isInteger(value) && value >= 1 && value <= 100)) errors.value = "A whole number from 1 to 100";
    if (d.kind === "flat" && !(d.value && paiseOf(d.value) >= 100 && value <= MAX_OFF_RUPEES)) errors.value = most;
    if (d.kind === "percent" && d.cap && !(paiseOf(d.cap) >= 100 && Number(d.cap) <= MAX_OFF_RUPEES)) errors.cap = `${most}, or empty for no most`;
    if (d.starts && d.starts < today) errors.starts = "Pick today or a later day";
  }
  if (d.minOrder && Number(d.minOrder) > MAX_MIN_ORDER_RUPEES) errors.minOrder = "Up to ₹5,00,000, or empty for none";
  if (d.ends && (d.ends < today || (d.starts && d.ends < d.starts))) errors.ends = "Pick a day on or after the start";
  if (d.limit && !(Number(d.limit) >= 1 && Number(d.limit) <= MAX_USES)) errors.limit = "At least 1, or empty for no limit";
  if (d.perCustomer && !(Number(d.perCustomer) >= 1 && Number(d.perCustomer) <= MAX_PER_CUSTOMER)) errors.perCustomer = `1 to ${MAX_PER_CUSTOMER}, or empty for no limit`;
  if (needsShops && !d.businessIds.length) errors.shops = "Pick at least one shop";
  return errors;
}

const terms = (d: CouponDraft) => ({
  minOrder: d.minOrder ? paiseOf(d.minOrder) : 0,
  startsAt: d.starts ? startOf(d.starts) : null,
  endsAt: d.ends ? endOf(d.ends) : null,
  limit: d.limit ? Number(d.limit) : null,
  perCustomer: d.perCustomer ? Number(d.perCustomer) : null,
  firstOrderOnly: d.firstOrderOnly,
  listed: d.listed,
});

/** The body without shops; a vendor's adds `businessIds`. */
export function newCouponOf(d: CouponDraft): NewCoupon {
  return {
    code: d.code,
    kind: d.kind,
    value: d.kind === "percent" ? Number(d.value) : paiseOf(d.value),
    ...(d.kind === "percent" ? { cap: d.cap ? paiseOf(d.cap) : null } : {}),
    ...terms(d),
  };
}

/** Only what changed since `before`. A start that has already passed isn't sent again. */
export function patchOf(d: CouponDraft, before: ManagedCoupon): CouponPatch {
  const next = terms(d);
  const was = terms(draftOf(before));
  const patch: CouponPatch = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (next[key] !== was[key]) Object.assign(patch, { [key]: next[key] });
  }
  if (before.state !== "scheduled") delete patch.startsAt;
  return patch;
}

export const shopsChanged = (d: CouponDraft, before: ManagedCoupon) =>
  [...d.businessIds].sort().join() !== before.businesses.map((b) => b.id).sort().join();
