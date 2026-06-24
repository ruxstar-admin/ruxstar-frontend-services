import type { VendorBooking } from "@/lib/api";

/** A booking counts as paid revenue when it is confirmed (Cashfree settled). */
export function isPaid(b: VendorBooking) {
  return b.status === "confirmed";
}

/** Settled amount for a booking, tolerant of older rows missing `amount`. */
export function bookingAmount(b: VendorBooking) {
  return b.amount ?? b.pricePerSlot ?? 0;
}

/** Best available transaction timestamp for a payment (ms since epoch). */
export function paymentTime(b: VendorBooking) {
  const iso = b.paidAt || b.createdAt || b.startAt;
  return iso ? new Date(iso).getTime() : 0;
}

/** YYYY-MM-DD in IST — stable bucket key for day grouping. */
function istDayKey(ms: number) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** YYYY-MM in IST. */
function istMonthKey(ms: number) {
  return istDayKey(ms).slice(0, 7);
}

export type DayBucket = {
  key: string;
  label: string;
  revenue: number;
  count: number;
};

export type VendorMetrics = {
  totalRevenue: number;
  monthRevenue: number;
  paidCount: number;
  upcomingCount: number;
  upcomingRevenue: number;
  avgBooking: number;
  cancelledCount: number;
  last7: DayBucket[];
  peakDayRevenue: number;
};

const EMPTY: VendorMetrics = {
  totalRevenue: 0,
  monthRevenue: 0,
  paidCount: 0,
  upcomingCount: 0,
  upcomingRevenue: 0,
  avgBooking: 0,
  cancelledCount: 0,
  last7: [],
  peakDayRevenue: 0,
};

/**
 * Single-pass aggregation over vendor bookings. All values derived client-side
 * from the already-cached bookings list, so callers add no network cost.
 */
export function computeVendorMetrics(bookings: VendorBooking[]): VendorMetrics {
  if (!bookings.length) return { ...EMPTY, last7: buildLast7Skeleton() };

  const now = Date.now();
  const thisMonth = istMonthKey(now);

  // Pre-seed the 7-day window so empty days still render as zero bars.
  const days = buildLast7Skeleton();
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));

  let totalRevenue = 0;
  let monthRevenue = 0;
  let paidCount = 0;
  let upcomingCount = 0;
  let upcomingRevenue = 0;
  let cancelledCount = 0;

  for (const b of bookings) {
    if (b.status === "cancelled") {
      cancelledCount += 1;
      continue;
    }
    if (!isPaid(b)) continue;

    const amount = bookingAmount(b);
    totalRevenue += amount;
    paidCount += 1;

    const txMs = paymentTime(b);
    if (istMonthKey(txMs) === thisMonth) monthRevenue += amount;

    const idx = dayIndex.get(istDayKey(txMs));
    if (idx !== undefined) {
      days[idx].revenue += amount;
      days[idx].count += 1;
    }

    if (new Date(b.startAt).getTime() > now) {
      upcomingCount += 1;
      upcomingRevenue += amount;
    }
  }

  const peakDayRevenue = days.reduce((max, d) => Math.max(max, d.revenue), 0);

  return {
    totalRevenue,
    monthRevenue,
    paidCount,
    upcomingCount,
    upcomingRevenue,
    avgBooking: paidCount ? Math.round(totalRevenue / paidCount) : 0,
    cancelledCount,
    last7: days,
    peakDayRevenue,
  };
}

/** Last 7 IST days (oldest → today) with zeroed totals. */
function buildLast7Skeleton(): DayBucket[] {
  const out: DayBucket[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i -= 1) {
    const ms = now - i * 86400000;
    out.push({
      key: istDayKey(ms),
      label: new Date(ms).toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }),
      revenue: 0,
      count: 0,
    });
  }
  return out;
}

export function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
