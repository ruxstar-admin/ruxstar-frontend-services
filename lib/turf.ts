import type { TagTone } from "@/components/ui";
import type {
  AddOn,
  AddOnPer,
  Amenity,
  CourtView,
  GroundStatus,
  Hours,
  Prices,
  SlotMinutes,
  TurfBookingStatus,
} from "@/lib/api/turf";
import { money } from "@/lib/api/shops";
import { istParts } from "@/lib/events";

export { dayText, istParts, istToday, paiseOf, timeText } from "@/lib/events";

export const AMENITY_LABEL: Record<Amenity, string> = {
  parking: "Parking",
  washrooms: "Washrooms",
  changing_rooms: "Changing rooms",
  showers: "Showers",
  drinking_water: "Drinking water",
  floodlights: "Floodlights",
  seating: "Seating",
  cafe: "Café",
  first_aid: "First aid",
  equipment: "Equipment to rent",
  lockers: "Lockers",
  wifi: "Wi-Fi",
};
export const AMENITIES = Object.keys(AMENITY_LABEL) as Amenity[];

export const BOOKING_STATUS: Record<TurfBookingStatus, { label: string; tone: TagTone }> = {
  awaiting_payment: { label: "Not paid yet", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const GROUND_STATUS: Record<GroundStatus, { label: string; tone: TagTone }> = {
  draft: { label: "Draft", tone: "warning" },
  live: { label: "Live", tone: "success" },
  removed: { label: "Taken down", tone: "danger" },
};
export const PER_LABEL: Record<AddOnPer, string> = { booking: "per booking", slot: "per slot" };

/** The team permissions that open the desk, in the order the board needs them. */
export const TURF_PERMISSIONS = ["turf.bookings", "turf.block", "turf.cancel", "turf.arrivals", "turf.prices"] as const;
export type TurfPermission = (typeof TURF_PERMISSIONS)[number];

// Days and clocks, the same as the app's booking pieces.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
/** Monday first, as the week reads. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_SHORT = WEEKDAYS;
export const DAY_LONG = WEEKDAYS_LONG;

const utcOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};
export const weekdayOf = (key: string) => utcOf(key).getUTCDay();
export const addDays = (key: string, days: number) => new Date(utcOf(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** India's day key for a moment. */
export const istDayKey = (at: number) => istParts(new Date(at).toISOString()).day;

/** "Sunday 15 November", for screen readers. */
export function dayLong(key: string): string {
  const d = utcOf(key);
  return `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
}
/** "Sun, 15 Nov". */
export function dayShort(key: string): string {
  const d = utcOf(key);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export interface StripDay {
  key: string;
  /** "Today", "Tomorrow", then "Sat 21". */
  label: string;
  weekday: number;
  closed: boolean;
}

/** The next `count` days in India from `now`; weekdays in `closedWeekdays` are shut. */
export function stripDays(count: number, now: number, closedWeekdays: readonly number[] = []): StripDay[] {
  const start = utcOf(istDayKey(now)).getTime();
  const shut = new Set(closedWeekdays);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start + i * DAY_MS);
    const weekday = d.getUTCDay();
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${WEEKDAYS[weekday]} ${d.getUTCDate()}`;
    return { key: d.toISOString().slice(0, 10), label, weekday, closed: shut.has(weekday) };
  });
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const endMinutes = (hhmm: string) => minutesOf(hhmm) || 24 * 60;
const parts = (hhmm: string) => {
  const total = minutesOf(hhmm) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return { hour: h % 12 === 0 ? 12 : h % 12, minutes: m ? `:${String(m).padStart(2, "0")}` : "", half: h < 12 ? "am" : "pm" };
};

/** "7 pm", "7:30 am", "12 am" for midnight. */
export function clockText(hhmm: string): string {
  const p = parts(hhmm);
  return `${p.hour}${p.minutes} ${p.half}`;
}

/** "7–9 pm", "11 am–1 pm", "10:30–11:30 pm". */
export function rangeText(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  return a.half === b.half ? `${a.hour}${a.minutes}–${b.hour}${b.minutes} ${b.half}` : `${clockText(start)}–${clockText(end)}`;
}

/** India's clock of a moment, with midnight at the end of a slot as 24:00. */
export const clockOf = (iso: string, end = false) => {
  const time = istParts(iso).time;
  return end && time === "00:00" ? "24:00" : time;
};

/** "Sat, 21 Nov · 7–9 pm" for a booked date. */
export const whenText = (startAt: string, endAt: string) => `${dayShort(istParts(startAt).day)} · ${rangeText(clockOf(startAt), clockOf(endAt, true))}`;

/** Every half hour of the day for open, close and peak pickers; `24:00` closes at midnight. */
export const HALF_HOURS = Array.from({ length: 49 }, (_, i) => {
  const value = `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
  return { value, label: i === 48 ? "Midnight" : clockText(value) };
});

// Picking slots: always back to back, like the app.

/** What a slot looks like to the customer. `peak` can still be picked; `booked` and `blocked` can't. */
export type SlotLook = "free" | "peak" | "booked" | "blocked";

export interface PickSlot {
  key: string;
  start: string;
  end: string;
  price: number;
  state: SlotLook;
}

export const isPickable = (slot: Pick<PickSlot, "state">) => slot.state === "free" || slot.state === "peak";
const touches = (a: PickSlot, b: PickSlot) => endMinutes(a.end) === minutesOf(b.start);

/**
 * The selection after tapping `key`. A slot next to the selection extends it, any other slot starts again, tapping either
 * end shrinks it, and tapping one in the middle ends the selection there. `slots` and `selected` are in time order.
 */
export function toggleSlot(slots: readonly PickSlot[], selected: readonly string[], key: string): string[] {
  const at = slots.findIndex((s) => s.key === key);
  const slot = slots[at];
  if (!slot || !isPickable(slot)) return [...selected];
  if (!selected.length) return [key];
  const first = slots.findIndex((s) => s.key === selected[0]);
  const last = slots.findIndex((s) => s.key === selected[selected.length - 1]);
  if (first < 0 || last < 0) return [key];
  if (at >= first && at <= last) {
    if (first === last) return [];
    if (at === first) return selected.slice(1);
    return selected.slice(0, at - first);
  }
  if (at === last + 1 && touches(slots[last]!, slot)) return [...selected, key];
  if (at === first - 1 && touches(slot, slots[first]!)) return [key, ...selected];
  return [key];
}

/**
 * The selection still valid after the slots reload: the first back-to-back run of picked slots still free. The same array
 * when nothing changed, so it can be worked out during render.
 */
export function keepSelection(slots: readonly PickSlot[], selected: string[]): string[] {
  const kept: string[] = [];
  let prev: PickSlot | undefined;
  for (const slot of slots) {
    if (!selected.includes(slot.key)) {
      if (kept.length) break;
      continue;
    }
    if (!isPickable(slot) || (prev && !touches(prev, slot))) break;
    kept.push(slot.key);
    prev = slot;
  }
  return kept.length === selected.length ? selected : kept;
}

/** "2 slots · 7–9 pm", or "" when nothing is picked. */
export function selectionSummary(slots: readonly PickSlot[], selected: readonly string[]) {
  const picked = slots.filter((s) => selected.includes(s.key));
  if (!picked.length) return { count: 0, total: 0, text: "" };
  const total = picked.reduce((sum, s) => sum + s.price, 0);
  return {
    count: picked.length,
    total,
    text: `${picked.length} ${picked.length === 1 ? "slot" : "slots"} · ${rangeText(picked[0]!.start, picked[picked.length - 1]!.end)}`,
  };
}

/** What add-ons cost on one date: per booking once, per slot for each slot. */
export const addOnsCost = (addOns: readonly AddOn[], quantities: Record<string, number>, slots: number) =>
  addOns.reduce((sum, a) => sum + a.price * (quantities[a.id] ?? 0) * (a.per === "slot" ? slots : 1), 0);

/** The same day each week, the first included. */
export const repeatDays = (day: string, weeks: number) => Array.from({ length: weeks }, (_, k) => addDays(day, k * 7));

/** A slot's start that many weeks later, the same India clock. */
export const weeksLater = (iso: string, weeks: number) => new Date(Date.parse(iso) + weeks * 7 * DAY_MS).toISOString();

// Refunds, the same sentence as the app.

export interface RefundTier {
  hoursBefore: number;
  percent: number;
}

const duration = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours % 24 === 0) return hours === 24 ? "1 day" : `${hours / 24} days`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
};
const share = (percent: number, first: boolean) => (percent >= 100 ? (first ? "Full refund" : "full refund") : `${percent}% back`);
const paying = (tiers: readonly RefundTier[]) => tiers.filter((t) => t.percent > 0).sort((a, b) => b.hoursBefore - a.hoursBefore);

/**
 * The refund rule in one sentence, for above a Pay button. [{6,100},{2,50}] → "Full refund if you cancel at least 6 hours
 * before it starts, 50% back if at least 2 hours before, and no refund after that."
 */
export function refundLine(tiers: readonly RefundTier[], what = "it starts"): string {
  const steps = paying(tiers);
  if (!steps.length) return "No refund if you cancel.";
  const items = steps.map((t, i) => {
    if (i === 0) return `${share(t.percent, true)} if you cancel ${t.hoursBefore > 0 ? `at least ${duration(t.hoursBefore)} before ${what}` : `any time before ${what}`}`;
    return t.hoursBefore > 0 ? `${share(t.percent, false)} if at least ${duration(t.hoursBefore)} before` : `${share(t.percent, false)} after that, until ${what}`;
  });
  if (steps[steps.length - 1]!.hoursBefore > 0) items.push("no refund after that");
  if (items.length === 1) return `${items[0]}.`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}.`;
}

/** The percent refunded when cancelling `hoursLeft` hours before the start; 0 once it has started. */
export function refundPercentAt(tiers: readonly RefundTier[], hoursLeft: number): number {
  if (hoursLeft <= 0) return 0;
  return paying(tiers).reduce((best, t) => (hoursLeft >= t.hoursBefore ? Math.max(best, t.percent) : best), 0);
}

/** A ground's refund rule as tiers: full back from `fullHours`, `halfPercent` from `halfHours`. */
export const groundTiers = (refunds: { fullHours: number; halfHours: number; halfPercent: number }): RefundTier[] =>
  refunds.halfHours < refunds.fullHours
    ? [
        { hoursBefore: refunds.fullHours, percent: 100 },
        { hoursBefore: refunds.halfHours, percent: refunds.halfPercent },
      ]
    : [{ hoursBefore: refunds.fullHours, percent: 100 }];

export const GROUND_CANCELS = "If the ground cancels, you get everything back.";

// Prices.

/** "From ₹600 a slot". */
export const priceFromText = (priceFrom: number | null) => (priceFrom === null ? "Not taking bookings" : `From ${money(priceFrom)} a slot`);

/** "₹800 · weekends ₹1,000 · peak from ₹1,200" for one court, per slot. */
export function pricesText(prices: Prices, slotMinutes: number): string {
  const per = `${money(prices.base)} per ${slotMinutes} min`;
  const weekend = prices.weekend !== null ? `weekends ${money(prices.weekend)}` : null;
  const peak = prices.peak.length ? `peak ${money(Math.min(...prices.peak.map((p) => p.price)))}${prices.peak.length > 1 ? "+" : ""}` : null;
  return [per, weekend, peak].filter(Boolean).join(" · ");
}

/** "Mon–Fri", "Sat, Sun", "Every day". */
export function daysText(days: readonly number[]): string {
  if (days.length === 7) return "Every day";
  const ordered = WEEK.filter((d) => days.includes(d));
  const runs: number[][] = [];
  for (const d of ordered) {
    const run = runs.at(-1);
    const prev = run?.at(-1);
    if (run && prev !== undefined && WEEK.indexOf(d as (typeof WEEK)[number]) === WEEK.indexOf(prev as (typeof WEEK)[number]) + 1) run.push(d);
    else runs.push([d]);
  }
  return runs.map((r) => (r.length > 2 ? `${WEEKDAYS[r[0]!]}–${WEEKDAYS[r.at(-1)!]}` : r.map((d) => WEEKDAYS[d]).join(", "))).join(", ");
}

/** "Mon–Fri 6 am–11 pm · Sat, Sun 5 am–midnight", grouping days with the same hours. */
export function hoursText(hours: readonly Hours[]): string {
  if (!hours.length) return "Closed every day";
  const groups = new Map<string, number[]>();
  for (const day of WEEK) {
    const h = hours.find((x) => x.day === day);
    if (!h) continue;
    const key = `${h.open}-${h.close}`;
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }
  return [...groups.entries()]
    .map(([key, days]) => {
      const [open, close] = key.split("-") as [string, string];
      return `${daysText(days)} ${rangeText(open, close)}`;
    })
    .join(" · ");
}

export const slotLengthText = (minutes: SlotMinutes | number) => (minutes === 60 ? "1 hour" : minutes === 90 ? "1½ hours" : `${minutes} minutes`);

/** Where the court is open, for the date strip: the weekdays it isn't. */
export const closedWeekdays = (court: Pick<CourtView, "hours">) => [0, 1, 2, 3, 4, 5, 6].filter((d) => !court.hours.some((h) => h.day === d));

/** A Google Maps link: the pin when there is one, else a search for the address. No key; opens the app on phones. */
export function directionsUrl(place: { name: string; address: string; city: string; point: { lat: number; lng: number } | null }): string {
  if (place.point) return `https://www.google.com/maps/dir/?api=1&destination=${place.point.lat},${place.point.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address}, ${place.city}`)}`;
}

/** A booking's next date still to come, or its last one. */
export const nextDate = <O extends { status: string; endAt: string }>(b: { occurrences: O[] }, now = Date.now()): O =>
  b.occurrences.find((o) => o.status === "booked" && Date.parse(o.endAt) > now) ?? b.occurrences.at(-1)!;

/** "1 week", "4 weeks". */
export const weeksText = (n: number) => `${n} week${n === 1 ? "" : "s"}`;
