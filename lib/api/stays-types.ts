/**
 * PG / Hostels' API shapes, written from the backend's `src/modules/stays/contracts.ts`. Amounts are paise; times are ISO
 * strings; days are India's `YYYY-MM-DD` and clocks India's `HH:MM`.
 */

import type { InvoiceRef } from "./invoices";
import type { paths } from "./schema";

/** pg and coliving rooms are usually let by the month, hostel beds by the night; any room can offer both. */
export type StayKind = "pg" | "hostel" | "coliving";
export type StayFor = "men" | "women" | "any";
export type Occupant = "students" | "working";
export type Meal = "breakfast" | "lunch" | "dinner";
/** non_veg serves veg too; none: no food. */
export type FoodType = "veg" | "non_veg" | "none";
export type StayUnit = "month" | "night";
/** private: reserved whole, priced per room. shared: priced per bed. */
export type RoomKind = "private" | "shared";
export type RoomFeature = "ac" | "attached_bath" | "balcony" | "furnished" | "window";
export type NearbyKind = "college" | "office" | "metro" | "other";
export type PropertyStatus = "draft" | "live" | "removed";
/** paused: shown as full, not reservable. */
export type RoomStatus = "live" | "paused";
export type StayStatus = "awaiting_payment" | "confirmed" | "moved_in" | "moved_out" | "cancelled";

export interface Facility {
  key: string;
  name: string;
}
export interface StayPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}
export interface Point {
  lat: number;
  lng: number;
}
export interface Food {
  type: FoodType;
  /** Meals included in the rent; empty when `type` is none. */
  meals: Meal[];
}
export interface HouseRules {
  /** Latest entry time; null for none. */
  curfew: string | null;
  guests: boolean;
  smoking: boolean;
  alcohol: boolean;
  pets: boolean;
  notes: string | null;
}
export interface Deposit {
  amount: number;
  note: string | null;
}
export interface Nearby {
  kind: NearbyKind;
  name: string;
  km: number;
}
/** For each bed of a shared room, or the whole private room. At least one. */
export interface RoomPrices {
  month: number | null;
  night: number | null;
}

export interface StaysRules {
  refundDays: number;
  maxRefundDays: number;
  objectionHours: number;
  maxMonths: number;
  maxNights: number;
  holdMinutes: number;
  bookAheadDays: number;
  maxProperties: number;
  maxRooms: number;
  maxBeds: number;
}
export interface StaysRulesView extends StaysRules {
  commissionBps: number;
  platformFee: number;
}

// Properties and rooms, as customers see them.

export interface Bed {
  id: string;
  /** A, B, C… in the room. */
  label: string;
}
export interface RoomView {
  id: string;
  name: string;
  kind: RoomKind;
  beds: number;
  /** Shared rooms: every bed can be reserved together, at the bed price times the beds. */
  wholeRoom: boolean;
  prices: RoomPrices;
  features: RoomFeature[];
  status: RoomStatus;
  bedList: Bed[];
}

export interface PropertyCard {
  id: string;
  name: string;
  kind: StayKind;
  business: { id: string; name: string };
  city: string;
  area: string | null;
  address: string;
  photo: StayPhoto | null;
  for: StayFor;
  /** Empty: anyone. */
  occupants: Occupant[];
  food: Food;
  facilities: Facility[];
  /** The lowest price per bed (or private room) of its reservable rooms. */
  priceFrom: { month: number | null; night: number | null };
  units: StayUnit[];
  roomKinds: RoomKind[];
  noticeDays: number;
  deposit: number;
  nearby: Nearby[];
}
export interface PropertyFilters {
  city?: string;
  area?: string;
  q?: string;
  kind?: StayKind;
  for?: "men" | "women";
  occupant?: Occupant;
  food?: FoodType | "any";
  /** Comma-separated. */
  meals?: string;
  /** Comma-separated facility keys. */
  facilities?: string;
  stay?: StayUnit;
  priceMax?: number;
  room?: RoomKind;
  near?: string;
  noticeMax?: number;
  /** Comma-separated: guests, smoking, alcohol, pets, late_entry. */
  allows?: string;
}

export interface PropertyDetail extends PropertyCard {
  description: string | null;
  addressDetail: { line: string; area: string | null; city: string; pincode: string | null; point: Point | null };
  photos: StayPhoto[];
  rules: HouseRules;
  depositDetail: Deposit;
  /** Reservable and full rooms, in the property's order. */
  rooms: RoomView[];
  refundDays: number;
  refundRule: string;
  platformFee: number;
  status: PropertyStatus;
  canReserve: boolean;
  whyNot: string | null;
  kycRequired: true;
  rating?: { average: number | null; count: number };
}

export interface AvailabilityQuery {
  moveIn: string;
  stay?: StayUnit;
  months?: number;
  nights?: number;
}
/** taken: reserved or held for someone's checkout at some point of the stay. closed: the owner marked it full. */
export type BedState = "free" | "taken" | "closed";
export interface AvailabilityRoom {
  id: string;
  name: string;
  kind: RoomKind;
  status: RoomStatus;
  beds: { id: string; label: string; state: BedState }[];
  /** One free bed for this stay, before coupons and the fee; null when none is free or not let this way. */
  bedTotal: number | null;
  /** The whole room for this stay; null when it can't be reserved whole for these dates. */
  roomTotal: number | null;
}
export interface Availability {
  property: { id: string; name: string };
  moveIn: string;
  stay: StayUnit;
  /** stay=night: the checkout day. stay=month: null. */
  until: string | null;
  reservable: boolean;
  rooms: AvailabilityRoom[];
}

// Reserving.

interface StayFields {
  bedId?: string;
  whole?: boolean;
  moveIn: string;
  stay?: StayUnit;
  months?: number;
  nights?: number;
}
export interface ReserveInput extends StayFields {
  coupon?: string;
  returnTo: string;
}
export interface OffersInput extends StayFields {
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
export interface AppliedCoupon {
  code: string;
  fundedBy: "ruxstar" | "vendor";
  label: string;
}
export type ObjectionStatus = "open" | "withdrawn" | "released" | "refunded";
export interface Objection {
  reason: string;
  at: string;
  status: ObjectionStatus;
  note: string | null;
  resolvedAt: string | null;
}

interface ReservationFields {
  id: string;
  orderNo: number;
  status: StayStatus;
  property: { id: string; name: string; kind: StayKind; address: string; city: string; point: Point | null; photo: StayPhoto | null; removed: boolean };
  room: { id: string; name: string; kind: RoomKind };
  beds: Bed[];
  whole: boolean;
  business: { id: string; name: string };
  stay: StayUnit;
  /** Months or nights paid. */
  units: number;
  moveIn: string;
  from: string;
  /** When the beds are free again; null while a monthly stay has no end date. */
  until: string | null;
  price: { unitPrice: number; quantity: number; items: number; discount: number; platformFee: number; total: number };
  coupon: AppliedCoupon | null;
  deposit: Deposit;
  noticeDays: number;
  refundRule: string;
  refundUntil: string;
  refund: { amount: number; status: "pending" | "done"; reason: string | null; at: string } | null;
  cancellation: { by: "customer" | "property" | "ruxstar" | "system"; reason: string; at: string } | null;
  movedInAt: string | null;
  objectionUntil: string | null;
  objection: Objection | null;
  moveOut: { on: string; kind: "notice" | "move_out"; by: "tenant" | "property" | "ruxstar" } | null;
  staying: boolean;
  reason: string | null;
  payBy: string | null;
  createdAt: string;
}
export interface StayReservation extends ReservationFields {
  canCancel: boolean;
  refundIfCancelled: number | null;
  canObject: boolean;
  canGiveNotice: boolean;
  noticeFrom: string | null;
  invoices?: InvoiceRef[];
  canReview?: boolean;
  reviewUntil?: string | null;
}
export interface Placed {
  reservation: StayReservation;
  checkoutUrl: string;
}
export type MyStaysView = "current" | "past";

// The owner's setup.

export interface PropertyInput {
  name: string;
  kind?: StayKind;
  description?: string | null;
  address: { line: string; area?: string | null; city: string; pincode?: string | null; point?: Point | null };
  for: StayFor;
  occupants?: Occupant[];
  food?: Food;
  facilities?: string[];
  rules?: HouseRules;
  noticeDays?: number;
  deposit?: { amount: number; note?: string | null };
  nearby?: Nearby[];
  refundDays?: number;
}
export type PropertyPatch = Partial<PropertyInput>;
export interface RoomInput {
  name: string;
  kind: RoomKind;
  beds: number;
  wholeRoom?: boolean;
  prices: RoomPrices;
  features?: RoomFeature[];
  status?: RoomStatus;
}
export type RoomPatch = Partial<RoomInput>;

export interface VendorProperty extends PropertyDetail {
  refundLimits: { min: number; max: number };
  publishedAt: string | null;
  removal: { reason: string; at: string } | null;
  missing: string[];
  upcoming: number;
  staying: number;
}

// The desk: the owner and their team.

export interface DeskProperty {
  id: string;
  name: string;
  kind: StayKind;
  business: { id: string; name: string };
  status: PropertyStatus;
  rooms: number;
  beds: number;
  owner: boolean;
  permissions: string[];
}
export interface BoardReservation {
  id: string;
  orderNo: number;
  tenantName: string;
  status: StayStatus;
  moveIn: string;
  until: string | null;
}
/** That day. held: someone is paying now. reserved: paid, not moved in. occupied: moved in. */
export type BoardBedState = "free" | "held" | "reserved" | "occupied" | "closed";
export interface BoardBed {
  id: string;
  label: string;
  /** closed: you marked it full. */
  status: "open" | "closed";
  state: BoardBedState;
  reservation: BoardReservation | null;
  next: BoardReservation | null;
}
export interface BoardRoom {
  id: string;
  name: string;
  kind: RoomKind;
  status: RoomStatus;
  prices: RoomPrices;
  beds: BoardBed[];
}
export interface Board {
  property: { id: string; name: string };
  date: string;
  rooms: BoardRoom[];
  totals: { beds: number; free: number; held: number; reserved: number; occupied: number; closed: number };
}
export type Payout = "none" | "waiting" | "objection" | "released" | "refunded";
export interface DeskReservation extends ReservationFields {
  tenant: { name: string; phone: string | null; verified: boolean };
  vendorShare: number;
  payout: Payout;
  releaseAt: string | null;
  canMoveIn: boolean;
  canMoveOut: boolean;
  canCancel: boolean;
}
export type DeskReservationsView = "upcoming" | "staying" | "past" | "all";

// The console.

export interface ConsoleProperty extends PropertyCard {
  status: PropertyStatus;
  vendorId: string;
  removal: { reason: string; at: string } | null;
  createdAt: string;
}
export interface ConsolePropertyDetail {
  property: VendorProperty;
  reservations: { upcoming: number; staying: number; total: number; cancelled: number; objections: number };
}
export interface ConsoleFacility {
  key: string;
  name: string;
  active: boolean;
  order: number;
}
export interface ConsoleReservation extends ReservationFields {
  tenant: { id: string; name: string };
  vendorId: string;
  releaseAt: string | null;
  releasedAt: string | null;
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
  Assert<Same<StaysRulesView, Data<paths["/v1/stays/rules"]["get"]>>>,
  Assert<Same<Facility, Item<Data<paths["/v1/stays/facilities"]["get"]>>>>,
  Assert<Same<PropertyCard, Item<Data<paths["/v1/stays/"]["get"]>>>>,
  Assert<Same<PropertyFilters, Omit<Query<paths["/v1/stays/"]["get"]>, "cursor" | "limit">>>,
  Assert<Same<PropertyDetail, Data<paths["/v1/stays/{id}"]["get"]>>>,
  Assert<Same<AvailabilityQuery, Query<paths["/v1/stays/{id}/availability"]["get"]>>>,
  Assert<Same<Availability, Data<paths["/v1/stays/{id}/availability"]["get"]>>>,
  Assert<Same<Offers, Data<paths["/v1/stays/rooms/{id}/offers"]["post"]>>>,
  Assert<Same<OffersInput, Body<paths["/v1/stays/rooms/{id}/offers"]["post"]>>>,
  Assert<Same<Placed, Data<paths["/v1/stays/rooms/{id}/reserve"]["post"]>>>,
  Assert<Same<ReserveInput, Body<paths["/v1/stays/rooms/{id}/reserve"]["post"]>>>,
  Assert<Same<StayReservation, Item<Data<paths["/v1/stays/orders"]["get"]>>>>,
  Assert<Same<StayReservation, Data<paths["/v1/stays/orders/{id}"]["get"]>>>,
  Assert<Same<StayReservation, Data<paths["/v1/stays/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<StayReservation, Data<paths["/v1/stays/orders/{id}/objection"]["post"]>>>,
  Assert<Same<StayReservation, Data<paths["/v1/stays/orders/{id}/objection"]["delete"]>>>,
  Assert<Same<StayReservation, Data<paths["/v1/stays/orders/{id}/notice"]["post"]>>>,
  Assert<Same<{ checkoutUrl: string }, Data<paths["/v1/stays/orders/{id}/pay"]["post"]>>>,
  Assert<Same<VendorProperty, Item<Data<paths["/v1/vendor/businesses/{id}/properties"]["get"]>>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/businesses/{id}/properties"]["post"]>>>,
  Assert<Same<PropertyInput, Body<paths["/v1/vendor/businesses/{id}/properties"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}"]["get"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}"]["patch"]>>>,
  Assert<Same<PropertyPatch, Body<paths["/v1/vendor/properties/{id}"]["patch"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}/photos"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}/photos/{photoId}"]["delete"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}/publish"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/properties/{id}/rooms"]["post"]>>>,
  Assert<Same<RoomInput, Body<paths["/v1/vendor/properties/{id}/rooms"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/rooms/{id}"]["patch"]>>>,
  Assert<Same<RoomPatch, Body<paths["/v1/vendor/rooms/{id}"]["patch"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/vendor/rooms/{id}"]["delete"]>>>,
  Assert<Same<DeskProperty, Item<Data<paths["/v1/stays/desk/properties"]["get"]>>>>,
  Assert<Same<Board, Data<paths["/v1/stays/desk/properties/{id}/board"]["get"]>>>,
  Assert<Same<DeskReservation, Item<Data<paths["/v1/stays/desk/properties/{id}/reservations"]["get"]>>>>,
  Assert<Same<DeskReservation, Item<Data<paths["/v1/stays/desk/properties/{id}/tenants"]["get"]>>>>,
  Assert<Same<DeskReservation, Data<paths["/v1/stays/desk/orders/{id}"]["get"]>>>,
  Assert<Same<DeskReservation, Data<paths["/v1/stays/desk/orders/{id}/moved-in"]["post"]>>>,
  Assert<Same<DeskReservation, Data<paths["/v1/stays/desk/orders/{id}/move-out"]["post"]>>>,
  Assert<Same<DeskReservation, Data<paths["/v1/stays/desk/orders/{id}/cancel"]["post"]>>>,
  Assert<Same<{ id: string; label: string; status: "open" | "closed" }, Data<paths["/v1/stays/desk/beds/{id}/status"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/stays/desk/rooms/{id}/status"]["post"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/stays/desk/properties/{id}"]["patch"]>>>,
  Assert<Same<VendorProperty, Data<paths["/v1/stays/desk/rooms/{id}/prices"]["put"]>>>,
  Assert<Same<ConsoleProperty, Item<Data<paths["/v1/ruxstar/stays/properties"]["get"]>>>>,
  Assert<Same<ConsolePropertyDetail, Data<paths["/v1/ruxstar/stays/properties/{id}"]["get"]>>>,
  Assert<Same<{ property: VendorProperty; refunded: number }, Data<paths["/v1/ruxstar/stays/properties/{id}/take-down"]["post"]>>>,
  Assert<Same<ConsoleReservation, Item<Data<paths["/v1/ruxstar/stays/objections"]["get"]>>>>,
  Assert<Same<ConsoleReservation, Data<paths["/v1/ruxstar/stays/reservations/{id}/objection"]["post"]>>>,
  Assert<Same<ConsoleFacility, Item<Data<paths["/v1/ruxstar/stays/facilities"]["get"]>>>>,
  Assert<Same<ConsoleFacility, Data<paths["/v1/ruxstar/stays/facilities"]["post"]>>>,
  Assert<Same<ConsoleFacility, Data<paths["/v1/ruxstar/stays/facilities/{key}"]["patch"]>>>,
  Assert<Same<StaysRules, NonNullable<Item<Data<paths["/v1/ruxstar/modules"]["get"]>>["staysRules"]>>>,
];
