/** IST calendar helpers for slot views (YYYY-MM-DD). */

export function formatDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr: string, days: number) {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
}

export function todayLocal() {
  return formatDateOnly(new Date());
}

export function formatDayLabel(dateStr: string) {
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function formatTime12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Days shown per calendar page (customer + vendor). */
export const SLOT_VIEW_DAYS = 7;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekDayKey = (typeof DAY_KEYS)[number];

/** Weekday key in Asia/Kolkata, aligned with backend slot engine. */
export function dayKeyForDate(dateStr: string): WeekDayKey {
  const utc = Date.parse(`${dateStr}T12:00:00+05:30`);
  if (Number.isNaN(utc)) return "mon";
  return DAY_KEYS[new Date(utc).getUTCDay()];
}

/** How far ahead customers can book from today. */
export const MAX_BOOK_AHEAD_DAYS = 90;

export function dateRangeFrom(startDate: string, spanDays = SLOT_VIEW_DAYS) {
  return { from: startDate, to: addDays(startDate, spanDays - 1) };
}

/** @deprecated Use dateRangeFrom — kept for older call sites. */
export function weekRangeFrom(startDate: string) {
  return dateRangeFrom(startDate, 7);
}

export function formatRangeLabel(from: string, to: string) {
  return `${formatDayLabel(from)} – ${formatDayLabel(to)}`;
}

export function clampRangeStart(startDate: string) {
  const today = todayLocal();
  return startDate < today ? today : startDate;
}

export function canGoPrevRange(startDate: string) {
  return startDate > todayLocal();
}

export function canGoNextRange(startDate: string) {
  const { to } = dateRangeFrom(startDate);
  const maxTo = addDays(todayLocal(), MAX_BOOK_AHEAD_DAYS - 1);
  return to < maxTo;
}

export function shiftRangeStart(startDate: string, direction: -1 | 1) {
  const next = addDays(startDate, direction * SLOT_VIEW_DAYS);
  if (direction < 0) {
    return clampRangeStart(next);
  }
  return canGoNextRange(startDate) ? next : startDate;
}
