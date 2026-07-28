"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listVendorBookings, type VendorBooking } from "@/lib/api";
import { formatDayLabel, formatTime12, todayLocal } from "@/lib/date-utils";
import { StaffTimeOffPanel } from "@/components/staff-time-off-panel";

type Props = {
  businessId: string;
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function ServiceAppointmentsBoard({ businessId }: Props) {
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBookings(await listVendorBookings({ businessId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayLocal();

  const { upcoming, grouped } = useMemo(() => {
    const confirmed = bookings
      .filter((b) => b.status === "confirmed")
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const up = confirmed.filter((b) => dayKey(b.startAt) >= today);
    const map = new Map<string, VendorBooking[]>();
    for (const b of up) {
      const key = dayKey(b.startAt);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    return { upcoming: up, grouped: [...map.entries()] };
  }, [bookings, today]);

  if (loading) {
    return <div className="glass h-full w-full animate-pulse rounded-2xl" />;
  }

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 border-b border-white/8 bg-[#0c0c0e] px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Upcoming appointments</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {upcoming.length} booked · paid bookings only
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
        {error && (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
            {error}
          </p>
        )}

        <div className="mb-4">
          <StaffTimeOffPanel businessId={businessId} />
        </div>

        {grouped.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-600">
            No upcoming appointments yet. They&apos;ll appear here once customers book and pay.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/80">
                  {date === today ? "Today" : formatDayLabel(date)}
                </p>
                <div className="mt-2 space-y-2">
                  {items.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100">
                          {formatTime12(b.startAt.slice(11, 16))}
                          {b.endAt ? ` – ${formatTime12(b.endAt.slice(11, 16))}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-400">
                          {b.serviceLabel || b.resourceName || "Appointment"}
                          {b.resourceName ? ` · ${b.resourceName}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-600">
                          {b.customerName}
                          {b.customerMobile ? ` · ${b.customerMobile}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-300">
                        ₹{(b.amount ?? b.pricePerSlot).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
