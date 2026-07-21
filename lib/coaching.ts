import type { BusinessService, PriceOption } from "@/lib/api";
import type { DayKey } from "@/lib/api";
import { parseDateOnly } from "@/lib/date-utils";

export type PricingModel = "per_session" | "hourly" | "daily" | "weekly" | "monthly";
export type EnrollmentType = "open" | "limited" | "batch" | "monthly";
export type PeriodKind = "exact" | "day" | "week" | "month";
/** How the customer selects when booking a payment option. */
export type SelectionKind = "time" | "day" | "week" | "month";

export type ClassTiming = {
  day: DayKey;
  startTime: string;
  endTime?: string;
  batchLabel?: string;
};

export const PRICING_MODEL_OPTIONS: { value: PricingModel; label: string; customerLabel: string }[] = [
  { value: "hourly", label: "Hourly", customerLabel: "Hourly" },
  { value: "daily", label: "Daily", customerLabel: "Daily" },
  { value: "per_session", label: "Per session", customerLabel: "Per class" },
  { value: "weekly", label: "Weekly", customerLabel: "Weekly" },
  { value: "monthly", label: "Monthly", customerLabel: "Monthly" },
];

/** Payment types a vendor can offer on any class — all are available
 * regardless of schedule. `daily` additionally carries a "pick a time" flag. */
export const VENDOR_PRICING_MODELS: {
  value: Exclude<PricingModel, "per_session">;
  label: string;
  hint: string;
}[] = [
  { value: "hourly", label: "Hourly", hint: "Charge per hour; customer picks a time slot" },
  { value: "daily", label: "Daily", hint: "Flat price for a day" },
  { value: "weekly", label: "Weekly", hint: "Flat price; customer picks a week" },
  { value: "monthly", label: "Monthly", hint: "Flat price; customer picks a month" },
];

export const ENROLLMENT_OPTIONS: { value: EnrollmentType; label: string; hint: string }[] = [
  { value: "open", label: "Open slots", hint: "Flexible times within your hours" },
  { value: "limited", label: "Limited seats", hint: "Cap how many can join each slot" },
  { value: "batch", label: "Batch-wise", hint: "Fixed days & times (e.g. Mon/Wed 6pm)" },
  { value: "monthly", label: "Month-wise", hint: "Fixed schedule billed monthly" },
];

export const DAY_OPTIONS: { value: DayKey; label: string }[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

export function pricingModelCustomerLabel(model?: PricingModel): string {
  const found = PRICING_MODEL_OPTIONS.find((o) => o.value === (model ?? "per_session"));
  return found?.customerLabel ?? "Per class";
}

export function pricingUnitLabel(model?: PricingModel): string {
  switch (model) {
    case "hourly":
      return "/hr";
    case "daily":
    case "per_session":
      return "/class";
    case "weekly":
      return "/week";
    case "monthly":
      return "/month";
    default:
      return "";
  }
}

/** A payment option that bills once for a whole period instead of one class. */
export function periodKindForModel(model?: PricingModel): PeriodKind {
  if (model === "monthly") return "month";
  if (model === "weekly") return "week";
  return "exact";
}

export function isPeriodModel(model?: PricingModel): boolean {
  return periodKindForModel(model) !== "exact";
}

/** How the customer picks when booking this option:
 *  time  → a specific start time (hourly / per_session / daily-with-time)
 *  day   → a whole day (daily whole-day)
 *  week  → a week pass
 *  month → a month pass */
export function selectionKindForOption(option?: PriceOption): SelectionKind {
  if (!option) return "time";
  if (option.pricingModel === "monthly") return "month";
  if (option.pricingModel === "weekly") return "week";
  if (option.pricingModel === "daily") return option.pickTime ? "time" : "day";
  return "time";
}

export function enrollmentNeedsCapacity(type?: EnrollmentType): boolean {
  return type === "limited" || type === "batch" || type === "monthly";
}

export function enrollmentNeedsTimings(type?: EnrollmentType): boolean {
  return type === "batch" || type === "monthly";
}

export function isMonthlyClass(svc: Pick<BusinessService, "pricingModel" | "enrollmentType">): boolean {
  return svc.pricingModel === "monthly" || svc.enrollmentType === "monthly";
}

export function isBatchClass(svc: Pick<BusinessService, "enrollmentType">): boolean {
  return svc.enrollmentType === "batch" || svc.enrollmentType === "monthly";
}

/** All payment options for a class, falling back to its single legacy
 * price/pricingModel fields for services that predate `priceOptions`. */
export function servicePriceOptions(
  svc: Pick<BusinessService, "price" | "pricingModel" | "priceOptions">,
): PriceOption[] {
  if (svc.priceOptions?.length) return svc.priceOptions;
  return [{ pricingModel: svc.pricingModel ?? "per_session", price: svc.price }];
}

/** Resolve which payment option a request refers to, defaulting to the
 * class's primary (first) option when none/an invalid one is given. */
export function resolvePriceOption(
  svc: Pick<BusinessService, "price" | "pricingModel" | "priceOptions">,
  requestedModel?: string,
): PriceOption {
  const options = servicePriceOptions(svc);
  if (requestedModel) {
    const found = options.find((o) => o.pricingModel === requestedModel);
    if (found) return found;
  }
  return options[0];
}

export function formatPriceOption(option: PriceOption, durationMinutes?: number): string {
  return formatServicePrice(option.price, option.pricingModel, durationMinutes);
}

export function formatServicePrice(price: number, model?: PricingModel, durationMinutes?: number): string {
  const unit = pricingUnitLabel(model);
  if (model === "hourly" && durationMinutes) {
    const sessionTotal = Math.round(price * (durationMinutes / 60));
    return `₹${price.toLocaleString("en-IN")}${unit} · ₹${sessionTotal.toLocaleString("en-IN")} this session`;
  }
  return `₹${price.toLocaleString("en-IN")}${unit}`;
}

/** Short "From ₹X" summary across every payment option, for class cards. */
export function formatServicePriceSummary(
  svc: Pick<BusinessService, "price" | "pricingModel" | "priceOptions" | "durationMinutes">,
): string {
  const options = servicePriceOptions(svc);
  if (options.length === 1) return formatPriceOption(options[0], svc.durationMinutes);
  const cheapest = [...options].sort((a, b) => a.price - b.price)[0];
  return `From ₹${cheapest.price.toLocaleString("en-IN")}${pricingUnitLabel(cheapest.pricingModel)}`;
}

export function formatEnrollmentLabel(type?: EnrollmentType, maxParticipants?: number): string {
  if (type === "batch") return "Batch class";
  if (type === "monthly") return "Monthly enrollment";
  if (type === "limited" && maxParticipants) return `Up to ${maxParticipants} per slot`;
  return "";
}

export function formatClassSchedule(timings?: ClassTiming[]): string {
  if (!timings?.length) return "";
  return timings
    .map((t) => {
      const day = DAY_OPTIONS.find((d) => d.value === t.day)?.label ?? t.day;
      const time = t.endTime ? `${t.startTime}–${t.endTime}` : t.startTime;
      return `${day} ${time}${t.batchLabel ? ` · ${t.batchLabel}` : ""}`;
    })
    .join(" · ");
}

/** "YYYY-MM" key for the calendar month a date-only string falls in. */
export function monthKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function formatMonthYear(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** "YYYY-MM-DD" of the Monday that starts the week a date-only string falls in. */
export function weekKeyFromDate(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  const dow = d.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftWeekKey(weekKey: string, delta: number): string {
  const d = parseDateOnly(weekKey);
  if (!d) return weekKey;
  d.setDate(d.getDate() + delta * 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatWeekRange(weekKey: string): string {
  const d = parseDateOnly(weekKey);
  if (!d) return weekKey;
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(d)} – ${fmt(end)}`;
}

/** Human label for a period-billed booking's coverage, e.g. "week of 14 Jul"
 * or "July 2026". Falls back to nothing for one-off (exact) bookings. */
export function periodCoverageLabel(periodKind?: PeriodKind, periodKey?: string): string {
  if (!periodKey) return "";
  if (periodKind === "month") return formatMonthYear(`${periodKey}-01`);
  if (periodKind === "week") return `week of ${formatWeekRange(periodKey).split(" – ")[0]}`;
  if (periodKind === "day") return formatDayLabel(periodKey);
  return "";
}

/** Short label for a whole-day (daily) booking, e.g. "Fri, 17 Jul". */
export function formatDayLabel(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export function customerPaymentExplanation(
  svc: Pick<BusinessService, "enrollmentType">,
  model?: PricingModel,
): string {
  if (model === "hourly") {
    return "Pay for this session only. Amount = hourly rate × class length.";
  }
  if (model === "weekly") {
    return "Pay a flat weekly fee. Pick a week and your pass covers every session that week.";
  }
  if (model === "monthly" || svc.enrollmentType === "monthly") {
    return "Pay a flat monthly fee. Pick a month and your pass covers every session that month.";
  }
  if (model === "daily" || model === "per_session" || !model) {
    return "Pay a flat daily fee. Pick the day you want to attend.";
  }
  return "Pay once when you confirm this booking.";
}

export function customerTimePickerHint(svc: BusinessService, model?: PricingModel): string {
  if (svc.enrollmentType === "monthly" || model === "monthly") {
    return "Pick your batch start date. Your pass covers every scheduled session that month.";
  }
  if (svc.enrollmentType === "batch" && model === "weekly") {
    return "Pick your batch start date. Your pass covers every scheduled session that week.";
  }
  if (svc.enrollmentType === "batch") {
    return "Pick a date, then choose your fixed batch time.";
  }
  if (model === "hourly") {
    return "Pick any open slot within coaching hours.";
  }
  return "Pick a date and time that works for you.";
}

export function customerConfirmPaymentLine(
  amount: number,
  model?: PricingModel,
  slotDate?: string,
): { title: string; detail: string } {
  const month = slotDate ? formatMonthYear(slotDate) : "";
  const week = slotDate ? formatWeekRange(weekKeyFromDate(slotDate)) : "";

  if (model === "monthly") {
    return {
      title: `Pay ₹${amount.toLocaleString("en-IN")} — monthly enrollment`,
      detail: month
        ? `Covers ${month} on the class schedule below.`
        : "Covers the full month on the published schedule.",
    };
  }
  if (model === "weekly") {
    return {
      title: `Pay ₹${amount.toLocaleString("en-IN")} — weekly pass`,
      detail: week
        ? `Covers the week of ${week} on the class schedule below.`
        : "Valid for this class for the week of your selected start date.",
    };
  }
  if (model === "hourly") {
    return {
      title: `Pay ₹${amount.toLocaleString("en-IN")} — this session`,
      detail: "Hourly rate applied to this class length.",
    };
  }
  if (model === "daily") {
    return {
      title: `Pay ₹${amount.toLocaleString("en-IN")} — day pass`,
      detail: slotDate
        ? `Covers ${formatDayLabel(slotDate)}.`
        : "Covers the day you selected.",
    };
  }
  return {
    title: `Pay ₹${amount.toLocaleString("en-IN")} — this class`,
    detail: "One-time payment for the session you selected.",
  };
}

export function slotEnrolledCount(slot: {
  enrolledCount?: number;
  maxParticipants?: number;
  seatsLeft?: number;
}): number | null {
  if (typeof slot.enrolledCount === "number") return slot.enrolledCount;
  if (slot.maxParticipants != null && slot.seatsLeft != null) {
    return Math.max(0, slot.maxParticipants - slot.seatsLeft);
  }
  return null;
}

export function slotFillRatio(slot: {
  enrolledCount?: number;
  maxParticipants?: number;
  seatsLeft?: number;
}): number | null {
  const enrolled = slotEnrolledCount(slot);
  if (enrolled == null || !slot.maxParticipants) return null;
  return Math.min(1, enrolled / slot.maxParticipants);
}

/** Unique payment types present across a coaching service list (filter tabs). */
export function coachingPaymentFilters(
  services: BusinessService[],
): { id: string; label: string }[] {
  const tabs: { id: string; label: string }[] = [{ id: "all", label: "All" }];
  const seen = new Set<string>();
  for (const svc of services) {
    for (const opt of servicePriceOptions(svc)) {
      const key = opt.pricingModel === "per_session" ? "daily" : opt.pricingModel;
      if (seen.has(key)) continue;
      seen.add(key);
      tabs.push({ id: key, label: pricingModelCustomerLabel(key === "daily" ? "daily" : opt.pricingModel) });
    }
  }
  return tabs;
}

export function serviceMatchesPaymentFilter(svc: BusinessService, filterId: string): boolean {
  if (filterId === "all") return true;
  return servicePriceOptions(svc).some((opt) => {
    if (filterId === "daily") return opt.pricingModel === "daily" || opt.pricingModel === "per_session";
    return opt.pricingModel === filterId;
  });
}
