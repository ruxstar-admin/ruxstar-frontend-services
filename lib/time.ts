const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dayYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const full = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

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

/** 999, 1.2K, 3.4M. */
export const compact = (n: number) => (n < 1000 ? String(n) : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n));
