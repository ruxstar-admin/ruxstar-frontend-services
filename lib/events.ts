import type { TagTone } from "@/components/ui";
import type {
  EventCard,
  EventDetail,
  EventInput,
  EventKind,
  EventQuestion,
  EventRules,
  HolderInput,
  RefundPolicy,
  ScanOutcome,
  TicketOrderStatus,
  TicketStatus,
  VendorEvent,
  VendorEventStatus,
} from "@/lib/api/events";
import { money } from "@/lib/api/shops";

export const KIND_LABEL: Record<EventKind, string> = { show: "Concerts & shows", sports: "Sports", meetup: "Workshops & meetups" };
export const KINDS = Object.keys(KIND_LABEL) as EventKind[];

export const ORDER_STATUS: Record<TicketOrderStatus, { label: string; tone: TagTone }> = {
  awaiting_payment: { label: "Not paid yet", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: TagTone }> = {
  awaiting_payment: { label: "Not paid yet", tone: "warning" },
  valid: { label: "Valid", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
export const EVENT_STATUS: Record<VendorEventStatus, { label: string; tone: TagTone }> = {
  draft: { label: "Draft", tone: "warning" },
  live: { label: "On sale", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  ended: { label: "Ended", tone: "neutral" },
};

/** What the gate shows for each result: green to let in, amber when they're back, red to stop. */
export const OUTCOME: Record<ScanOutcome, { tone: "success" | "warning" | "danger"; title: string }> = {
  ok: { tone: "success", title: "Let them in" },
  inside: { tone: "warning", title: "Already inside today" },
  wrong_event: { tone: "danger", title: "Wrong event" },
  wrong_day: { tone: "danger", title: "Not today" },
  cancelled: { tone: "danger", title: "Not valid" },
  unknown: { tone: "danger", title: "Not a ticket" },
};

const IST_MS = 330 * 60_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** A moment as India's calendar day and clock: `{ day: 'YYYY-MM-DD', time: 'HH:MM' }`. Events are in India, wherever the browser is. */
export function istParts(iso: string): { day: string; time: string } {
  const d = new Date(Date.parse(iso) + IST_MS);
  return { day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

/** India's `YYYY-MM-DD` and `HH:MM` as an ISO timestamp. */
export const fromIst = (day: string, time: string) => new Date(`${day}T${time}:00+05:30`).toISOString();

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat, 16 Nov" in India. */
export function dayText(iso: string): string {
  const d = new Date(Date.parse(iso) + IST_MS);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "7:30 pm" in India. */
export function timeText(iso: string): string {
  const d = new Date(Date.parse(iso) + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getUTCMinutes())} ${h < 12 ? "am" : "pm"}`;
}

/** "Sat, 16 Nov · 7:00 pm – 11:00 pm", or both days when it runs past midnight. */
export function whenLine(startsAt: string, endsAt: string): string {
  const sameDay = istParts(startsAt).day === istParts(endsAt).day;
  return sameDay
    ? `${dayText(startsAt)} · ${timeText(startsAt)} – ${timeText(endsAt)}`
    : `${dayText(startsAt)}, ${timeText(startsAt)} – ${dayText(endsAt)}, ${timeText(endsAt)}`;
}

/** "Free", "₹500 per team", "From ₹500". */
export function priceLine(card: Pick<EventCard, "free" | "team" | "priceFrom">): string {
  if (card.free) return "Free";
  return card.team ? `${money(card.priceFrom)} per team` : `From ${money(card.priceFrom)}`;
}

const titleCase = (city: string) => city.charAt(0).toUpperCase() + city.slice(1);

/** "Online", or the venue and city. */
export const placeLine = (card: Pick<EventCard, "online" | "venueName" | "city">) =>
  card.online ? "Online" : [card.venueName, card.city ? titleCase(card.city) : null].filter(Boolean).join(", ");

/** The refund rule in a sentence the customer reads before paying. */
export function refundText(refunds: EventDetail["refunds"], free = false): string {
  if (refunds.policy === "none")
    return free ? "The organiser has turned off cancelling for this event." : "No refunds. The organiser doesn’t give refunds for this event.";
  if (!refunds.until) return "Full refund if you cancel before the event starts.";
  const until = `${dayText(refunds.until)}, ${timeText(refunds.until)}`;
  return free
    ? `Cancel any time before ${until}.`
    : `Full refund, fee included, if you cancel before ${until}. If the organiser cancels, you always get it all back.`;
}

// Picking tickets and filling in one card per person.

/** Tickets wanted, by ticket type. */
export type Selection = Record<string, number>;

export const countOf = (selection: Selection) => Object.values(selection).reduce((sum, n) => sum + n, 0);

export function orderPrice(selection: Selection, tiers: { id: string; price: number }[], platformFee: number, team = false) {
  const items = tiers.reduce((sum, t) => sum + (team ? (selection[t.id] ? t.price : 0) : t.price * (selection[t.id] ?? 0)), 0);
  const fee = items > 0 ? platformFee : 0;
  return { items, fee, total: items + fee };
}

export interface PersonDraft {
  key: string;
  tierId: string;
  name: string;
  phone: string;
  answers: Record<string, string>;
}

let keys = 0;
const blank = (tierId: string): PersonDraft => ({ key: `p${keys++}`, tierId, name: "", phone: "", answers: {} });

type Buyer = { name: string | null; mobile: string | null };

/**
 * One card per ticket in the order picked, keeping what was typed when the counts change. The first card starts
 * with the buyer's own name and number, since most people buy for themselves too.
 */
export function peopleFor(selection: Selection, tierOrder: string[], previous: PersonDraft[], me?: Buyer): PersonDraft[] {
  const next: PersonDraft[] = [];
  for (const tierId of tierOrder) {
    const kept = previous.filter((p) => p.tierId === tierId);
    for (let i = 0; i < (selection[tierId] ?? 0); i++) next.push(kept[i] ?? blank(tierId));
  }
  if (next[0] && !previous.length && me) next[0] = { ...next[0], name: me.name ?? "", phone: me.mobile ?? "" };
  return next;
}

/** Players for a team entry, all on the team's ticket type. */
export function playersFor(count: number, tierId: string, previous: PersonDraft[], me?: Buyer) {
  return peopleFor({ [tierId]: count }, [tierId], previous.map((p) => ({ ...p, tierId })), me);
}

const PHONE = /^[6-9]\d{9}$/;
export const cleanPhone = (text: string) => text.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

/** What's wrong on one person's card, by field, in words. */
export function personErrors(person: PersonDraft, questions: EventQuestion[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (person.name.trim().length < 2) errors.name = "Add their name as on an ID";
  if (!PHONE.test(cleanPhone(person.phone))) errors.phone = "A 10-digit mobile number";
  for (const q of questions) if (q.required && !person.answers[q.id]?.trim()) errors[q.id] = "Needed";
  return errors;
}

export const toHolders = (people: PersonDraft[], questions: EventQuestion[]): HolderInput[] =>
  people.map((p) => {
    const answers = questions.filter((q) => p.answers[q.id]?.trim()).map((q) => ({ id: q.id, answer: p.answers[q.id]!.trim() }));
    return { tierId: p.tierId, name: p.name.trim(), phone: cleanPhone(p.phone), ...(answers.length ? { answers } : {}) };
  });

/** "2 × General, 1 × VIP" */
export const linesText = (lines: { name: string; quantity: number }[]) => lines.map((l) => `${l.quantity} × ${l.name}`).join(", ");

// Making an event.

export interface TierDraft {
  id?: string;
  name: string;
  /** Rupees as typed. */
  price: string;
  capacity: string;
  /** Sold or held, when editing: the floor for capacity, and it can't be removed. */
  taken: number;
}

export interface QuestionDraft {
  id?: string;
  label: string;
  required: boolean;
}

export interface EventDraft {
  kind: EventKind;
  title: string;
  description: string;
  online: boolean;
  venueName: string;
  address: string;
  city: string;
  link: string;
  startDay: string;
  startTime: string;
  endDay: string;
  endTime: string;
  team: boolean;
  teamMin: string;
  teamMax: string;
  tiers: TierDraft[];
  questions: QuestionDraft[];
  refunds: RefundPolicy;
}

export const emptyDraft = (kind: EventKind = "show", city = ""): EventDraft => ({
  kind,
  title: "",
  description: "",
  online: false,
  venueName: "",
  address: "",
  city,
  link: "https://",
  startDay: "",
  startTime: "19:00",
  endDay: "",
  endTime: "22:00",
  team: false,
  teamMin: "5",
  teamMax: "11",
  tiers: [{ name: "General", price: "", capacity: "", taken: 0 }],
  questions: [],
  refunds: "standard",
});

export function draftOf(event: VendorEvent): EventDraft {
  const start = istParts(event.startsAt);
  const end = istParts(event.endsAt);
  return {
    kind: event.kind,
    title: event.title,
    description: event.description ?? "",
    online: event.online,
    venueName: event.venue?.name ?? "",
    address: event.venue?.address ?? "",
    city: event.venue?.city ?? "",
    link: event.onlineLink ?? "https://",
    startDay: start.day,
    startTime: start.time,
    endDay: end.day,
    endTime: end.time,
    team: !!event.teamSize,
    teamMin: String(event.teamSize?.min ?? 5),
    teamMax: String(event.teamSize?.max ?? 11),
    tiers: event.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price ? String(t.price / 100) : "0",
      capacity: String(t.capacity),
      taken: t.sold + t.held,
    })),
    questions: event.questions.map((q) => ({ id: q.id, label: q.label, required: q.required })),
    refunds: event.refunds,
  };
}

/** Rupees typed, as paise; null when it isn't a price. */
export function paiseOf(text: string): number | null {
  const clean = text.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

export type DraftStep = "basics" | "when" | "tickets" | "extras";
export const DRAFT_STEPS: { key: DraftStep; label: string }[] = [
  { key: "basics", label: "About" },
  { key: "when", label: "When & where" },
  { key: "tickets", label: "Tickets" },
  { key: "extras", label: "Questions" },
];

/** What's wrong on one step of the event form, by field. `savedStart` is the start already saved: keeping it is fine once it has passed. */
export function draftErrors(
  draft: EventDraft,
  step: DraftStep,
  rules: Pick<EventRules, "maxTicketTypes" | "maxQuestions" | "maxDays">,
  now = Date.now(),
  savedStart?: string,
) {
  const errors: Record<string, string> = {};
  if (step === "basics") {
    if (draft.title.trim().length < 3) errors.title = "At least 3 letters";
  }
  if (step === "when") {
    if (!draft.startDay) errors.startDay = "Pick the day it starts";
    if (!draft.endDay) errors.endDay = "Pick the day it ends";
    if (draft.startDay && draft.endDay) {
      const start = Date.parse(fromIst(draft.startDay, draft.startTime));
      const end = Date.parse(fromIst(draft.endDay, draft.endTime));
      const kept = savedStart !== undefined && Date.parse(savedStart) === start;
      if (start <= now && !kept) errors.startDay = "Pick a time that hasn’t passed";
      else if (end <= start) errors.endTime = "It must end after it starts";
      else if (end - start > rules.maxDays * 24 * 60 * 60_000) errors.endDay = `Events run for up to ${rules.maxDays} days`;
    }
    if (draft.online) {
      if (!/^https:\/\/\S+\.\S+/.test(draft.link.trim())) errors.link = "The meeting link, starting https://";
    } else {
      if (draft.venueName.trim().length < 2) errors.venueName = "The venue’s name";
      if (draft.address.trim().length < 5) errors.address = "Street and area, so people can find it";
      if (draft.city.trim().length < 2) errors.city = "The city";
    }
  }
  if (step === "tickets") {
    if (draft.team) {
      const min = whole(draft.teamMin);
      const max = whole(draft.teamMax);
      if (!min || min < 1 || min > 50) errors.teamMin = "1 to 50";
      if (!max || max < 1 || max > 50) errors.teamMax = "1 to 50";
      else if (min && max < min) errors.teamMax = "At least the smallest team";
    }
    if (draft.tiers.length > rules.maxTicketTypes) errors.tiers = `Up to ${rules.maxTicketTypes} ticket types`;
    const names = new Set<string>();
    draft.tiers.forEach((t, i) => {
      const name = t.name.trim().toLowerCase();
      if (!name) errors[`tier${i}.name`] = "Name it, like General or VIP";
      else if (names.has(name)) errors[`tier${i}.name`] = "Each ticket type needs its own name";
      names.add(name);
      if (paiseOf(t.price) === null) errors[`tier${i}.price`] = "Rupees, or 0 for free";
      const capacity = whole(t.capacity);
      if (!capacity || capacity < 1) errors[`tier${i}.capacity`] = draft.team ? "How many teams" : "How many people";
      else if (capacity < t.taken) errors[`tier${i}.capacity`] = `${t.taken} already booked`;
    });
  }
  if (step === "extras") {
    if (draft.questions.length > rules.maxQuestions) errors.questions = `Up to ${rules.maxQuestions} questions`;
    draft.questions.forEach((q, i) => {
      if (q.label.trim().length < 3) errors[`question${i}`] = "Write the question, like T-shirt size";
    });
  }
  return errors;
}

export function toEventInput(draft: EventDraft): EventInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    kind: draft.kind,
    venue: draft.online ? null : { name: draft.venueName.trim(), address: draft.address.trim(), city: draft.city.trim() },
    online: draft.online ? { link: draft.link.trim() } : null,
    startsAt: fromIst(draft.startDay, draft.startTime),
    endsAt: fromIst(draft.endDay, draft.endTime),
    team: draft.team ? { min: Number(draft.teamMin), max: Number(draft.teamMax) } : null,
    tiers: draft.tiers.map((t) => ({ ...(t.id ? { id: t.id } : {}), name: t.name.trim(), price: paiseOf(t.price) ?? 0, capacity: Number(t.capacity) })),
    questions: draft.questions.map((q) => ({ ...(q.id ? { id: q.id } : {}), label: q.label.trim(), required: q.required })),
    refunds: draft.refunds,
  };
}

/** Times offered when picking when an event starts or ends: every half hour. */
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  return { value: `${pad(h)}:${pad(m)}`, label: `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "am" : "pm"}` };
});

/** "Mon 16 Nov" for India's `YYYY-MM-DD`. */
export function dayLabel(day: string): string {
  const d = new Date(Date.parse(`${day}T12:00:00Z`));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Today in India as `YYYY-MM-DD`, for the lowest date a picker allows. */
export const istToday = (now = Date.now()) => istParts(new Date(now).toISOString()).day;

/** Seats sold out of all seats, across ticket types. */
export function soldLine(event: Pick<VendorEvent, "tiers" | "teamSize">): string {
  const sold = event.tiers.reduce((sum, t) => sum + t.sold, 0);
  const capacity = event.tiers.reduce((sum, t) => sum + t.capacity, 0);
  return `${sold} of ${capacity} ${event.teamSize ? "teams" : "tickets"} booked`;
}

/** What was typed at the gate: a 10-digit mobile (with or without +91) or a six-letter code. */
export function lookupKind(text: string): { phone: string } | { code: string } | null {
  const digits = text.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (/^\d{10}$/.test(digits)) return { phone: digits };
  const code = text.replace(/\s/g, "").toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? { code } : null;
}

/** A Google Maps search for a venue: no key, opens the app on phones. */
export const mapsUrl = (venue: { name: string; address: string; city: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`;
