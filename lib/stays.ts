import type { TagTone } from "@/components/ui";
import { money } from "@/lib/api/shops";
import type {
  BoardBedState,
  Deposit,
  Food,
  FoodType,
  HouseRules,
  Meal,
  NearbyKind,
  Occupant,
  Payout,
  PropertyCard,
  PropertyStatus,
  RoomFeature,
  RoomKind,
  RoomPrices,
  StayFor,
  StayKind,
  StayReservation,
  StayStatus,
  StayUnit,
} from "@/lib/api/stays";
import type { TeamPermission } from "@/lib/api/team";
import { dayText, paiseOf, timeText } from "@/lib/events";
import { addDays, clockText, dayShort } from "@/lib/turf";

export { addDays, dayLong, dayShort, directionsUrl, istDayKey } from "@/lib/turf";
export { dayText, istParts, istToday, paiseOf, timeText } from "@/lib/events";

export const KIND_LABEL: Record<StayKind, string> = { pg: "PG", hostel: "Hostel", coliving: "Co-living" };
export const KINDS = Object.keys(KIND_LABEL) as StayKind[];

export const FOR_LABEL: Record<StayFor, string> = { men: "Men only", women: "Women only", any: "Anyone" };
export const FOR_SHORT: Record<StayFor, string> = { men: "For men", women: "For women", any: "For anyone" };
export const OCCUPANT_LABEL: Record<Occupant, string> = { students: "Students", working: "Working people" };
export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
export const MEALS = Object.keys(MEAL_LABEL) as Meal[];
export const FOOD_LABEL: Record<FoodType, string> = { veg: "Veg food", non_veg: "Veg and non-veg food", none: "No food" };
export const FEATURE_LABEL: Record<RoomFeature, string> = {
  ac: "AC",
  attached_bath: "Attached bathroom",
  balcony: "Balcony",
  furnished: "Furnished",
  window: "Window",
};
export const FEATURES = Object.keys(FEATURE_LABEL) as RoomFeature[];
export const NEARBY_LABEL: Record<NearbyKind, string> = { college: "College", office: "Office", metro: "Metro", other: "Place" };
export const ROOM_KIND_LABEL: Record<RoomKind, string> = { private: "Private room", shared: "Shared room" };

export const STAY_STATUS: Record<StayStatus, { label: string; tone: TagTone }> = {
  awaiting_payment: { label: "Not paid yet", tone: "warning" },
  confirmed: { label: "Reserved", tone: "success" },
  moved_in: { label: "Moved in", tone: "success" },
  moved_out: { label: "Moved out", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const PROPERTY_STATUS: Record<PropertyStatus, { label: string; tone: TagTone }> = {
  draft: { label: "Draft", tone: "warning" },
  live: { label: "Live", tone: "success" },
  removed: { label: "Taken down", tone: "danger" },
};
export const BED_STATE: Record<BoardBedState, string> = {
  free: "Free",
  held: "Someone is paying",
  reserved: "Reserved",
  occupied: "Moved in",
  closed: "Marked full",
};
export const PAYOUT_LABEL: Record<Payout, string> = {
  none: "No payout",
  waiting: "Paid out after the tenant moves in and the objection window closes",
  objection: "On hold: the tenant raised an objection",
  released: "Paid out",
  refunded: "Refunded to the tenant",
};

/** The team permissions for a property, in the order the desk uses them. */
export const STAYS_PERMISSIONS = ["stays.reservations", "stays.movein", "stays.beds", "stays.cancel", "stays.listing"] as const satisfies readonly TeamPermission[];
export type StaysPermission = (typeof STAYS_PERMISSIONS)[number];

// Words.

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const unitsText = (unit: StayUnit, n: number) => plural(n, unit);
export const PER_UNIT: Record<StayUnit, string> = { month: "a month", night: "a night" };

/** "₹8,000 a month · ₹600 a night", the lowest of the reservable rooms. */
export function priceFromText(priceFrom: PropertyCard["priceFrom"]): string {
  const parts = [
    priceFrom.month !== null ? `${money(priceFrom.month)} a month` : null,
    priceFrom.night !== null ? `${money(priceFrom.night)} a night` : null,
  ].filter(Boolean);
  return parts.length ? `From ${parts.join(" · ")}` : "Full right now";
}

/** "₹8,000 a month · ₹600 a night" for one bed, or the whole private room. */
export const pricesText = (prices: RoomPrices) =>
  [prices.month !== null ? `${money(prices.month)} a month` : null, prices.night !== null ? `${money(prices.night)} a night` : null]
    .filter(Boolean)
    .join(" · ");

export const perText = (kind: RoomKind) => (kind === "private" ? "for the room" : "per bed");

export function foodText(food: Food): string {
  if (food.type === "none") return "No food";
  const meals = MEALS.filter((m) => food.meals.includes(m)).map((m) => MEAL_LABEL[m].toLowerCase());
  return meals.length ? `${FOOD_LABEL[food.type]} · ${listText(meals)} included` : FOOD_LABEL[food.type];
}

export const listText = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export const forText = (forWhom: StayFor, occupants: Occupant[]) =>
  [FOR_LABEL[forWhom], occupants.length ? listText(occupants.map((o) => OCCUPANT_LABEL[o].toLowerCase())) : null].filter(Boolean).join(" · ");

export const depositText = (deposit: number) => (deposit > 0 ? `${money(deposit)} deposit, paid to the owner` : "No deposit");

export const noticeText = (days: number) => (days > 0 ? `${plural(days, "day")}’ notice to move out` : "No notice period");

export const kmText = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${Number.isInteger(km) ? km : km.toFixed(1)} km`);

/** House rules as yes and no lines, the curfew first. */
export function rulesList(rules: HouseRules): { text: string; ok: boolean }[] {
  return [
    { text: rules.curfew ? `Be in by ${clockText(rules.curfew)}` : "No entry time", ok: !rules.curfew },
    { text: rules.guests ? "Guests allowed" : "No guests", ok: rules.guests },
    { text: rules.smoking ? "Smoking allowed" : "No smoking", ok: rules.smoking },
    { text: rules.alcohol ? "Alcohol allowed" : "No alcohol", ok: rules.alcohol },
    { text: rules.pets ? "Pets allowed" : "No pets", ok: rules.pets },
  ];
}

/** "From Mon, 1 Dec · 3 months paid" or "Mon, 1 Dec – Thu, 4 Dec · 3 nights". */
export function stayText(r: { stay: StayUnit; units: number; moveIn: string }, monthly = true): string {
  if (r.stay === "night") return `${dayShort(r.moveIn)} – ${dayShort(addDays(r.moveIn, r.units))} · ${unitsText("night", r.units)}`;
  return `From ${dayShort(r.moveIn)}${monthly ? ` · ${unitsText("month", r.units)} paid` : ""}`;
}

/** "Tue, 2 Dec, 9:30 pm". */
export const momentText = (iso: string) => `${dayText(iso)}, ${timeText(iso)}`;

export type StepState = "done" | "now" | "todo" | "problem";
export interface TimelineStep {
  title: string;
  detail?: string | null;
  state: StepState;
}

type TimelineFields = Pick<StayReservation, "status" | "moveIn" | "movedInAt" | "objectionUntil" | "objection" | "moveOut" | "stay" | "units" | "payBy">;

/**
 * Where a reservation is, for the tenant or the owner: reserved, moved in, the window to raise a problem, then all set.
 * Cancelled reservations have no timeline.
 */
export function stayTimeline(r: TimelineFields, now: number, owner = false): TimelineStep[] {
  const paid = r.status !== "awaiting_payment";
  const movedIn = r.movedInAt !== null;
  const windowOpen = movedIn && r.objectionUntil !== null && Date.parse(r.objectionUntil) > now;
  const objection = r.objection;
  const open = objection?.status === "open";

  const reserved: TimelineStep = paid
    ? { title: "Reserved", detail: `Paid · moving in ${dayShort(r.moveIn)}`, state: "done" }
    : { title: "Pay to reserve", detail: r.payBy ? `Pay by ${timeText(r.payBy)} or the bed goes back.` : null, state: "now" };

  const arrived: TimelineStep = movedIn
    ? { title: "Moved in", detail: momentText(r.movedInAt!), state: "done" }
    : {
        title: "Move in",
        detail: owner ? `Tap Moved in when they arrive, on or after ${dayShort(r.moveIn)}.` : `On ${dayShort(r.moveIn)}. The owner marks it when you arrive.`,
        state: paid ? "now" : "todo",
      };

  let check: TimelineStep;
  if (open) {
    check = {
      title: "Problem raised",
      detail: owner
        ? "The tenant told Ruxstar something is wrong. Your payout waits while Ruxstar looks into it."
        : "Ruxstar support is looking into it. The owner isn’t paid until it’s sorted.",
      state: "problem",
    };
  } else if (objection?.status === "refunded") {
    check = { title: "Refunded by Ruxstar", detail: objection.note, state: "done" };
  } else if (objection?.status === "released") {
    check = { title: "Looked into by Ruxstar", detail: objection.note ?? "Ruxstar looked into it and paid the owner.", state: "done" };
  } else if (windowOpen) {
    check = owner
      ? { title: "Tenant is checking the place", detail: `They can raise a problem until ${momentText(r.objectionUntil!)}. You’re paid after that.`, state: "now" }
      : { title: "Check everything is right", detail: `Something wrong? Tell us by ${momentText(r.objectionUntil!)}. After that the owner is paid.`, state: "now" };
  } else if (movedIn) {
    check = { title: "Checked", detail: "The window to raise a problem has closed.", state: "done" };
  } else {
    check = {
      title: owner ? "Tenant checks the place" : "Check everything is right",
      detail: owner
        ? "After moving in, the tenant has a short window to raise a problem before you’re paid."
        : "After you move in, you have a short window to tell us if something’s wrong.",
      state: "todo",
    };
  }

  const settled = movedIn && !windowOpen && !open;
  const end =
    r.status === "moved_out"
      ? { title: "Moved out", detail: r.moveOut ? dayShort(r.moveOut.on) : null, state: "done" as const }
      : {
          title: "All set",
          detail: r.moveOut
            ? `Moving out ${dayShort(r.moveOut.on)}`
            : r.stay === "night"
              ? `Check out ${dayShort(addDays(r.moveIn, r.units))}`
              : "The stay runs until notice is given.",
          state: settled ? ("done" as const) : ("todo" as const),
        };

  return [reserved, arrived, check, end];
}

export const bedsText = (r: { whole: boolean; beds: { label: string }[]; room: { name: string; kind: RoomKind } }) =>
  r.whole || r.room.kind === "private" ? `${r.room.name} · whole room` : `${r.room.name} · bed ${r.beds.map((b) => b.label).join(", ")}`;

export const depositLine = (deposit: Deposit) =>
  deposit.amount > 0 ? `${money(deposit.amount)} deposit, paid to the owner, not on Ruxstar${deposit.note ? `. ${deposit.note}` : ""}` : "No deposit";

/** Room prices are at least ₹1 and at most ₹5,00,000 a month or a night. */
const MIN_PRICE = 100;
const MAX_PRICE = 5_00_000_00;

/** A price in paise as the rupees typed into a box; empty for none. */
export const rupees = (paise: number | null) => (paise ? String(paise / 100) : "");

/** Empty is fine (not let that way); anything else is ₹1 to ₹5,00,000. */
export function priceError(text: string): string | undefined {
  if (!text.trim()) return undefined;
  const p = paiseOf(text);
  return p === null || p < MIN_PRICE || p > MAX_PRICE ? "From ₹1 to ₹5,00,000" : undefined;
}

/** Commission in basis points as a percent, "12%". */
export const percentText = (bps: number) => `${bps % 100 === 0 ? bps / 100 : (bps / 100).toFixed(1)}%`;
