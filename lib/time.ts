const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dayYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const full = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** "now", "5m", "3h", "2d", then "4 Nov", with the year once it is not this year. */
export function ago(iso: string, now = Date.now()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now - then.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 1440)}d`;
  return then.getFullYear() === new Date(now).getFullYear() ? day.format(then) : dayYear.format(then);
}

/** For the `title` of a time element. */
export const exact = (iso: string) => full.format(new Date(iso));

/** "11:02 am", India time. */
export const clock = (iso: string) => time.format(new Date(iso));

const ymd = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" });

/** "2026-11-15": the India date of a moment, `days` later (or earlier when negative). */
export function istDate(at: Date | string = new Date(), days = 0): string {
  const [y, m, d] = ymd.format(new Date(at)).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** When an India date ("2026-11-15") starts, as an ISO date-time. */
export const istDayStart = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();

/** "11:02 am" today, otherwise the date too. India time. */
export const stamp = (iso: string) => (istDate(iso) === istDate() ? clock(iso) : exact(iso));

/** 999, 1.2K, 3.4M. */
export const compact = (n: number) => (n < 1000 ? String(n) : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n));
