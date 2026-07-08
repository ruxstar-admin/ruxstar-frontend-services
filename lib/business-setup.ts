import type { DayKey, WeeklyHours } from "@/lib/api";

export const SETUP_DAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const DAY_SHORT: Record<DayKey, string> = {
  mon: "Mo",
  tue: "Tu",
  wed: "We",
  thu: "Th",
  fri: "Fr",
  sat: "Sa",
  sun: "Su",
};

export const SLOT_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120];

export const VENUE_TYPE_ID = "venue";

export type BookingMode = "slots" | "fullDay" | "services";

/** Service-first appointment types (salon/clinic/coaching). */
export const SERVICE_TYPE_IDS = ["salon", "clinic", "coaching"] as const;

export function isServiceSetup(typeId: string) {
  return (SERVICE_TYPE_IDS as readonly string[]).includes(typeId);
}

export function isPartyVenueSetup(typeId: string) {
  return typeId === VENUE_TYPE_ID;
}

/** Turf & party venues choose hourly vs full-day when onboarding. */
export function needsBookingModeOnCreate(typeId: string) {
  return typeId === "turf" || typeId === VENUE_TYPE_ID;
}

export function bookingModeLabel(mode: BookingMode) {
  return mode === "fullDay" ? "Full day" : "Hourly slots";
}

export function hasSetupRulesStep(typeId: string, bookingMode: BookingMode) {
  return isPartyVenueSetup(typeId) || bookingMode === "fullDay";
}

export function defaultBookingModeForType(typeId: string): BookingMode {
  if (isServiceSetup(typeId)) return "services";
  return "slots";
}

export function priceLabel(bookingMode: BookingMode) {
  return bookingMode === "fullDay" ? "Price per day" : "Price per slot";
}

export function resourceBasePrice(
  resource: { pricePerSlot?: number },
  fallback = 0,
) {
  const p = Number(resource.pricePerSlot);
  if (Number.isFinite(p) && p >= 0) return Math.round(p);
  return Math.round(fallback);
}

export function resourcePriceRange(
  resources: { pricePerSlot?: number }[],
  fallback = 0,
) {
  if (!resources.length) return { min: fallback, max: fallback };
  const prices = resources.map((r) => resourceBasePrice(r, fallback));
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** @deprecated Use resolveSetupFlow from business-setup-flows.ts */
export type SetupWizardStep = "rules" | "photos" | "hours" | "days" | "resources" | "review";

/** Default day window for full-day bookings (not shown to vendor). */
export function applyFullDayHours(weeklyHours: WeeklyHours): WeeklyHours {
  const next = { ...weeklyHours };
  for (const day of SETUP_DAYS) {
    if (!next[day].closed) {
      next[day] = { closed: false, open: "09:00", close: "23:59" };
    }
  }
  return next;
}

export function resourceCopy(typeId: string) {
  if (typeId === "turf") {
    return {
      title: "Courts & turfs",
      hint: "Add each playable area customers can book separately.",
      placeholder: "e.g. Turf A",
    };
  }
  if (typeId === "salon") {
    return {
      title: "Chairs & stations",
      hint: "Add bookable stations or stylists.",
      placeholder: "e.g. Chair 1",
    };
  }
  if (typeId === "venue") {
    return {
      title: "Halls & spaces",
      hint: "Add each hall or area customers can book — parties, events, or full-day rentals.",
      placeholder: "e.g. Grand Hall",
    };
  }
  if (typeId === "clinic") {
    return {
      title: "Consultation rooms",
      hint: "Add rooms or doctors patients can book with.",
      placeholder: "e.g. Room 1",
    };
  }
  return {
    title: "Bookable resources",
    hint: "Add what customers reserve (court, room, chair, etc.).",
    placeholder: "e.g. Resource 1",
  };
}

export function supportsAppointmentSetup(module: string) {
  return module === "appointments";
}

// Legacy print type ids kept here so existing print businesses created before
// the types were collapsed still resolve to the print-on-demand setup flow.
export const PRINT_TYPE_IDS = [
  "print_shop",
  "custom_merch",
  "creator_merch",
  "corporate_printing",
  "event_printing",
  "branding_agency",
] as const;

export function isPrintType(typeId?: string) {
  return !!typeId && (PRINT_TYPE_IDS as readonly string[]).includes(typeId);
}

/**
 * Print-on-demand vendors run a lightweight setup (categories + service area).
 * We also key off the type id so a business still resolves to the print flow
 * even if its stored `module` is stale (e.g. created before `print` existed and
 * normalized to a fallback module).
 */
export function supportsPrintSetup(module: string, typeId?: string) {
  return module === "print" || isPrintType(typeId);
}

/** Any module that uses the post-create setup wizard. */
export function supportsSetup(module: string, typeId?: string) {
  return supportsAppointmentSetup(module) || supportsPrintSetup(module, typeId);
}

export function supportsEvents(module: string) {
  return module === "events";
}

/** Infer tournament vs ticketed event from the business type chosen at onboarding. */
export function defaultEventKindForBusiness(business: {
  typeId: string;
  typeLabel?: string;
}): "tournament" | "event" {
  if (business.typeId === "sports_event") return "tournament";
  if (business.typeId === "concert") return "event";
  const hint = `${business.typeId} ${business.typeLabel ?? ""}`.toLowerCase();
  if (/sport|tournament|cricket|football|badminton|tennis|esports/.test(hint)) {
    return "tournament";
  }
  return "event";
}
