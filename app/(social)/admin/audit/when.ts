import { istDate, istDayStart } from "@/lib/time";

export type When = "" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";

export const WHEN: { value: When; label: string }[] = [
  { value: "", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

export const isWhen = (value: string | null): value is When => WHEN.some((w) => w.value === value);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (value: string) => DATE.test(value);

/** The India day after a date like "2026-11-15". */
const nextDay = (date: string) => istDate(`${date}T12:00:00+05:30`, 1);

/**
 * `from` (inclusive) and `to` (exclusive) as ISO date-times, with days starting at midnight India time. A custom
 * range takes India dates, both days included.
 */
export function whenRange(when: When, from: string, to: string): { from?: string; to?: string } {
  const today = istDate();
  const tomorrow = istDayStart(nextDay(today));
  switch (when) {
    case "today":
      return { from: istDayStart(today), to: tomorrow };
    case "yesterday":
      return { from: istDayStart(istDate(new Date(), -1)), to: istDayStart(today) };
    case "7d":
      return { from: istDayStart(istDate(new Date(), -6)), to: tomorrow };
    case "30d":
      return { from: istDayStart(istDate(new Date(), -29)), to: tomorrow };
    case "month":
      return { from: istDayStart(`${today.slice(0, 8)}01`), to: tomorrow };
    case "custom":
      return { ...(isDate(from) ? { from: istDayStart(from) } : {}), ...(isDate(to) ? { to: istDayStart(nextDay(to)) } : {}) };
    default:
      return {};
  }
}
