/**
 * Sports & Turf's API shapes, written from the backend's `src/modules/turf/contracts.ts` and checked against the generated
 * schema at the end of this file. Amounts are paise; times are ISO strings; days are India's `YYYY-MM-DD` and clocks India's `HH:MM`.
 */

import type { InvoiceRef } from "./invoices";
import type { paths } from "./schema";

/** 0 Sunday, 1 Monday … 6 Saturday, as the API counts. */
export type Weekday = number;
export type SlotMinutes = 30 | 60 | 90;
export type GroundStatus = "draft" | "live" | "removed";
/** paused: shown but not bookable. */
export type CourtStatus = "live" | "paused";
export type TurfBookingStatus = "awaiting_payment" | "confirmed" | "cancelled";
export type Arrival = "arrived" | "no_show" | null;
/** booking: once per booking (per date of a repeat). slot: for each slot. */
export type AddOnPer = "booking" | "slot";
export type Amenity =
  | "parking"
  | "washrooms"
  | "changing_rooms"
  | "showers"
  | "drinking_water"
  | "floodlights"
  | "seating"
  | "cafe"
  | "first_aid"
  | "equipment"
  | "lockers"
  | "wifi";

export interface Sport {
  key: string;
  name: string;
}
export interface TurfPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}
export interface Point {
  lat: number;
  lng: number;
}
/** One open weekday. `close` can be 24:00 for midnight. */
export interface Hours {
  day: Weekday;
  open: string;
  close: string;
}
/** A slot starting in the window costs `price`, before the weekend price. */
export interface Peak {
  days: Weekday[];
  start: string;
  end: string;
  price: number;
}
export interface Prices {
  base: number;
  /** Saturday and Sunday; null for the base price. */
  weekend: number | null;
  peak: Peak[];
}
export interface AddOn {
  id: string;
  name: string;
  price: number;
  per: AddOnPer;
}

export interface TurfRules {
  refundFullHours: number;
  refundHalfHours: number;
  halfPercent: number;
  minFullHours: number;
  maxFullHours: number;
  maxRepeatWeeks: number;
  holdMinutes: number;
  slotLengths: SlotMinutes[];
  maxSlots: number;
  bookAheadDays: number;
  maxGrounds: number;
  maxCourts: number;
  maxAddOns: number;
}
export interface TurfRulesView extends TurfRules {
  commissionBps: number;
  platformFee: number;
}

// Grounds and courts, as customers see them.

export interface CourtView {
  id: string;
  name: string;
  sports: Sport[];
  slotMinutes: number;
  hours: Hours[];
  prices: Prices;
  addOns: AddOn[];
  status: CourtStatus;
}

export interface GroundCard {
  id: string;
  name: string;
  business: { id: string; name: string };
  city: string;
  address: string;
  /** The first photo. */
  photo: TurfPhoto | null;
  sports: Sport[];
  amenities: Amenity[];
  /** The lowest base price of a bookable court. */
  priceFrom: number | null;
  /** Bookable courts. */
  courts: number;
}
export interface GroundFilters {
  city?: string;
  sport?: string;
  q?: string;
}

export interface GroundDetail extends GroundCard {
  description: string | null;
  venue: { address: string; city: string; pincode: string | null; point: Point | null };
  photos: TurfPhoto[];
  /** Bookable and paused courts, in the ground's order. */
  courtList: CourtView[];
  refunds: { fullHours: number; halfHours: number; halfPercent: number };
  /** The refund rule in one sentence. */
  refundRule: string;
  platformFee: number;
  status: GroundStatus;
  canBook: boolean;
  whyNot: string | null;
  rating?: { average: number | null; count: number };
}

/** booked includes slots held for someone's checkout. */
export type PublicSlotState = "free" | "booked" | "blocked";
export interface DaySlot {
  startAt: string;
  endAt: string;
  start: string;
  end: string;
  price: number;
  peak: boolean;
  state: PublicSlotState;
}
export interface DaySlots {
  court: { id: string; name: string; slotMinutes: number; status: CourtStatus };
  date: string;
  /** False when the court is closed that day. */
  open: boolean;
  bookable: boolean;
  /** Slots that haven't started, in order. */
  slots: DaySlot[];
}

// Booking.

export interface AddOnPick {
  id: string;
  quantity: number;
}
export interface BookInput {
  /** Back-to-back slots of the court on one day, by their start. */
  startAts: string[];
  sport?: string;
  addOns?: AddOnPick[];
  weeks?: number;
  coupon?: string;
  returnTo: string;
}
export interface OffersInput {
  startAts: string[];
  addOns?: AddOnPick[];
  weeks?: number;
  code?: string;
}
export interface CouponOffer {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
  terms: string | null;
  discount: number;
  problem: string | null;
}
export interface Offers {
  offers: CouponOffer[];
  checked: { code: string; discount: number; problem: string | null } | null;
}

interface Money {
  percent: number;
  amount: number;
}
export interface Occurrence {
  /** 1 for the first date, 2 the week after, … */
  n: number;
  startAt: string;
  endAt: string;
  slots: { startAt: string; endAt: string; price: number; peak: boolean }[];
  items: number;
  paid: number;
  status: "booked" | "cancelled";
  refund: Money | null;
  cancelledBy: "customer" | "ground" | "ruxstar" | null;
  cancelReason: string | null;
  arrival: Arrival;
  canCancel: boolean;
  /** What cancelling it now gives back. */
  refundIfCancelled: Money | null;
}
export interface AppliedCoupon {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
}

interface BookingFields {
  id: string;
  orderNo: number;
  status: TurfBookingStatus;
  ground: { id: string; name: string; address: string; city: string; point: Point | null; photo: TurfPhoto | null; removed: boolean };
  court: { id: string; name: string };
  business: { id: string; name: string };
  sport: Sport | null;
  slotMinutes: number;
  addOns: { id: string; name: string; price: number; per: AddOnPer; quantity: number }[];
  weeks: number;
  occurrences: Occurrence[];
  firstAt: string;
  lastEndsAt: string;
  price: { items: number; discount: number; platformFee: number; total: number };
  coupon: AppliedCoupon | null;
  refundRule: string;
  refunds: { amount: number; status: "pending" | "done"; reason: string; at: string }[];
  reason: string | null;
  /** Unpaid, the slots go back after this. */
  payBy: string | null;
  createdAt: string;
}
export interface TurfBooking extends BookingFields {
  /** Some date can be cancelled now, or it is unpaid. */
  canCancel: boolean;
  invoices?: InvoiceRef[];
  canReview?: boolean;
  reviewUntil?: string | null;
}
export interface Placed {
  booking: TurfBooking;
  checkoutUrl: string;
}
export type MyBookingsView = "current" | "past";

// The owner's setup.

export interface VenueInput {
  address: string;
  city: string;
  pincode?: string | null;
  point?: Point | null;
}
export interface GroundInput {
  name: string;
  description?: string | null;
  venue: VenueInput;
  amenities?: Amenity[];
  refunds?: { fullHours: number; halfHours: number };
}
export type GroundPatch = Partial<GroundInput>;
export interface AddOnInput {
  /** Keep an add-on's id when changing it; leave out for a new one. */
  id?: string;
  name: string;
  price: number;
  per: AddOnPer;
}
export interface CourtInput {
  name: string;
  sports: string[];
  slotMinutes: SlotMinutes;
  /** One entry per open weekday; leave a day out to close it. */
  hours: Hours[];
  prices: Prices;
  addOns?: AddOnInput[];
  status?: CourtStatus;
}
export type CourtPatch = Partial<CourtInput>;
export interface PricesInput {
  prices?: Prices;
  addOns?: AddOnInput[];
}

export interface VendorGround extends GroundDetail {
  publishedAt: string | null;
  removal: { reason: string; at: string } | null;
  /** What it needs before it can be published. */
  missing: string[];
  /** Paid bookings with a date still to come. */
  upcoming: number;
}

// The desk: the owner and their team.

export interface DeskGround {
  id: string;
  name: string;
  business: { id: string; name: string };
  status: GroundStatus;
  courts: number;
  owner: boolean;
  /** The owner has every one. */
  permissions: string[];
}
export type BoardState = "free" | "held" | "booked" | "blocked";
export interface BoardBooking {
  id: string;
  orderNo: number;
  /** Which date of the booking. */
  n: number;
  weeks: number;
  customerName: string;
  /** Null for a held slot. */
  customerPhone: string | null;
  status: TurfBookingStatus;
  arrival: Arrival;
  startAt: string;
  endAt: string;
}
export interface BoardSlot {
  startAt: string;
  endAt: string;
  start: string;
  end: string;
  price: number;
  peak: boolean;
  past: boolean;
  state: BoardState;
  booking: BoardBooking | null;
  block: { note: string | null; by: string | null } | null;
}
export interface BoardCourt {
  id: string;
  name: string;
  slotMinutes: number;
  status: CourtStatus;
  open: boolean;
  slots: BoardSlot[];
}
export interface Board {
  ground: { id: string; name: string };
  date: string;
  courts: BoardCourt[];
  totals: { booked: number; blocked: number; free: number; arrived: number; noShow: number };
}
export interface DeskBooking extends BookingFields {
  customer: { name: string; phone: string | null };
  vendorShare: number;
  /** Some date hasn't ended. */
  canCancel: boolean;
}
export type DeskBookingsView = "upcoming" | "past" | "all";

// The console.

export interface ConsoleGround extends GroundCard {
  status: GroundStatus;
  vendorId: string;
  removal: { reason: string; at: string } | null;
  createdAt: string;
}
export interface ConsoleGroundDetail {
  ground: VendorGround;
  bookings: { upcoming: number; total: number; cancelled: number };
}
export interface ConsoleSport {
  key: string;
  name: string;
  active: boolean;
  order: number;
}

type Ok<R> = R extends { responses: infer Rs } ? Rs[keyof Rs & (200 | 201)] : never;
type Data<R> = Ok<R> extends { content: { "application/json": { data: infer D } } } ? D : never;
type Body<R> = R extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;
type Item<T> = T extends readonly (infer I)[] ? I : T;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** Each line stops compiling when the backend changes that shape; `npm run api:types` then shows what moved. */
export type ContractChecks = [
  Assert<Same<TurfRulesView, Data<paths["/v1/turf/rules"]["get"]>>>,
  Assert<Same<Sport, Item<Data<paths["/v1/turf/sports"]["get"]>>>>,
  Assert<Same<GroundCard, Item<Data<paths["/v1/turf/"]["get"]>>>>,
  Assert<Same<GroundDetail, Data<paths["/v1/turf/{id}"]["get"]>>>,
  Assert<Same<DaySlots, Data<paths["/v1/turf/courts/{id}/slots"]["get"]>>>,
  Assert<Same<Offers, Data<paths["/v1/turf/courts/{id}/offers"]["post"]>>>,
  Assert<Same<OffersInput, Body<paths["/v1/turf/courts/{id}/offers"]["post"]>>>,
  Assert<Same<Placed, Data<paths["/v1/turf/courts/{id}/book"]["post"]>>>,
  Assert<Same<BookInput, Body<paths["/v1/turf/courts/{id}/book"]["post"]>>>,
  Assert<Same<TurfBooking, Item<Data<paths["/v1/turf/orders"]["get"]>>>>,
  Assert<Same<TurfBooking, Data<paths["/v1/turf/orders/{id}"]["get"]>>>,
  Assert<Same<TurfBooking, Data<paths["/v1/turf/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<{ checkoutUrl: string }, Data<paths["/v1/turf/orders/{id}/pay"]["post"]>>>,
  Assert<Same<VendorGround, Item<Data<paths["/v1/vendor/businesses/{id}/grounds"]["get"]>>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/businesses/{id}/grounds"]["post"]>>>,
  Assert<Same<GroundInput, Body<paths["/v1/vendor/businesses/{id}/grounds"]["post"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}"]["get"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}"]["patch"]>>>,
  Assert<Same<GroundPatch, Body<paths["/v1/vendor/grounds/{id}"]["patch"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}/photos"]["post"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}/photos/{photoId}"]["delete"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}/publish"]["post"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/grounds/{id}/courts"]["post"]>>>,
  Assert<Same<CourtInput, Body<paths["/v1/vendor/grounds/{id}/courts"]["post"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/courts/{id}"]["patch"]>>>,
  Assert<Same<CourtPatch, Body<paths["/v1/vendor/courts/{id}"]["patch"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/vendor/courts/{id}"]["delete"]>>>,
  Assert<Same<DeskGround, Item<Data<paths["/v1/turf/desk/grounds"]["get"]>>>>,
  Assert<Same<Board, Data<paths["/v1/turf/desk/grounds/{id}/board"]["get"]>>>,
  Assert<Same<{ done: number }, Data<paths["/v1/turf/desk/slots/block"]["post"]>>>,
  Assert<Same<{ done: number }, Data<paths["/v1/turf/desk/slots/unblock"]["post"]>>>,
  Assert<Same<VendorGround, Data<paths["/v1/turf/desk/courts/{id}/prices"]["put"]>>>,
  Assert<Same<PricesInput, Body<paths["/v1/turf/desk/courts/{id}/prices"]["put"]>>>,
  Assert<Same<DeskBooking, Item<Data<paths["/v1/turf/desk/grounds/{id}/bookings"]["get"]>>>>,
  Assert<Same<DeskBooking, Data<paths["/v1/turf/desk/orders/{id}"]["get"]>>>,
  Assert<Same<DeskBooking, Data<paths["/v1/turf/desk/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<DeskBooking, Data<paths["/v1/turf/desk/orders/{id}/arrival"]["post"]>>>,
  Assert<Same<ConsoleGround, Item<Data<paths["/v1/ruxstar/turf/grounds"]["get"]>>>>,
  Assert<Same<ConsoleGroundDetail, Data<paths["/v1/ruxstar/turf/grounds/{id}"]["get"]>>>,
  Assert<Same<{ ground: VendorGround; refunded: number }, Data<paths["/v1/ruxstar/turf/grounds/{id}/take-down"]["post"]>>>,
  Assert<Same<ConsoleSport, Item<Data<paths["/v1/ruxstar/turf/sports"]["get"]>>>>,
  Assert<Same<ConsoleSport, Data<paths["/v1/ruxstar/turf/sports"]["post"]>>>,
  Assert<Same<ConsoleSport, Data<paths["/v1/ruxstar/turf/sports/{key}"]["patch"]>>>,
  Assert<Same<TurfRules, NonNullable<Item<Data<paths["/v1/ruxstar/modules"]["get"]>>["turfRules"]>>>,
];
