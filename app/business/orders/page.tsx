"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { useVendorBookings } from "@/lib/swr-hooks";
import { formatTime12 } from "@/lib/date-utils";
import type { VendorBooking } from "@/lib/api";

type Tab = "upcoming" | "today" | "past" | "cancelled" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

function istDayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function istTimeLabel(iso: string) {
  const t = new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  return formatTime12(t);
}

function dayParts(iso: string) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
    day: d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }),
    month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }),
  };
}

function fullDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export default function VendorOrdersPage() {
  const { kycVerified } = useVendorShell();
  const { data, isLoading, error } = useVendorBookings(kycVerified);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [businessId, setBusinessId] = useState<string>("all");

  const bookings = useMemo(() => data ?? [], [data]);

  const businessOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) {
      if (b.businessId) map.set(b.businessId, b.businessName || "Business");
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [bookings]);

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const now = Date.now();
    const revenue = confirmed.reduce((sum, b) => sum + (b.amount ?? b.pricePerSlot ?? 0), 0);
    const upcomingCount = confirmed.filter((b) => new Date(b.startAt).getTime() > now).length;
    return { total: confirmed.length, revenue, upcomingCount, cancelled: bookings.length - confirmed.length };
  }, [bookings]);

  const visible = useMemo(() => {
    const now = Date.now();
    const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    let rows = bookings;
    if (businessId !== "all") rows = rows.filter((b) => b.businessId === businessId);
    rows = rows.filter((b) => {
      const started = new Date(b.startAt).getTime() <= now;
      switch (tab) {
        case "upcoming":
          return b.status === "confirmed" && !started;
        case "today":
          return b.status === "confirmed" && istDayKey(b.startAt) === todayKey;
        case "past":
          return b.status === "confirmed" && started;
        case "cancelled":
          return b.status === "cancelled";
        case "all":
        default:
          return true;
      }
    });
    const dir = tab === "upcoming" || tab === "today" ? 1 : -1;
    return [...rows].sort((a, b) => dir * (+new Date(a.startAt) - +new Date(b.startAt)));
  }, [bookings, tab, businessId]);

  // Group visible bookings by IST day for a clean, scannable layout.
  const grouped = useMemo(() => {
    const groups = new Map<string, VendorBooking[]>();
    for (const b of visible) {
      const key = istDayKey(b.startAt);
      const arr = groups.get(key);
      if (arr) arr.push(b);
      else groups.set(key, [b]);
    }
    return Array.from(groups, ([key, items]) => ({ key, items }));
  }, [visible]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
          <p className="mt-2 text-sm text-zinc-400">Orders unlock after identity verification.</p>
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Go to KYC verification
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Orders</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Bookings</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Paid bookings across your businesses — who booked, when, and how much.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Paid bookings" value={String(stats.total)} />
        <StatCard label="Upcoming" value={String(stats.upcomingCount)} />
        <StatCard
          label="Revenue"
          value={`₹${stats.revenue.toLocaleString("en-IN")}`}
          accent
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition ${
                tab === t.id
                  ? "bg-white/15 text-zinc-100"
                  : "border border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {businessOptions.length > 1 && (
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="field-input h-9 w-full py-0 text-sm sm:w-52"
          >
            <option value="all">All businesses</option>
            {businessOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8 text-center text-sm text-red-300">
            Couldn&apos;t load bookings. Please refresh.
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-3xl">📭</p>
            <p className="mt-3 text-sm text-zinc-400">
              {tab === "cancelled"
                ? "No cancelled bookings."
                : tab === "past"
                  ? "No past bookings yet."
                  : "No bookings here yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {fullDateLabel(group.items[0].startAt)}
                </p>
                <ul className="space-y-2">
                  {group.items.map((b) => (
                    <OrderRow key={b.id} booking={b} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

function OrderRow({ booking }: { booking: VendorBooking }) {
  const { weekday, day, month } = dayParts(booking.startAt);
  const cancelled = booking.status === "cancelled";
  const amount = booking.amount ?? booking.pricePerSlot ?? 0;
  const telHref = booking.customerMobile ? `tel:${booking.customerMobile.replace(/\s/g, "")}` : null;

  return (
    <li
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
        cancelled ? "border-white/5 bg-white/[0.01] opacity-70" : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-white/5 text-center">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{weekday}</span>
        <span className="text-lg font-semibold leading-none text-zinc-100">{day}</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{month}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-zinc-100">{booking.customerName || "Customer"}</p>
          {cancelled && (
            <span className="shrink-0 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
              Cancelled
            </span>
          )}
        </div>
        <p className="truncate text-sm text-zinc-400">
          {istTimeLabel(booking.startAt)} · {booking.resourceName}
        </p>
        <p className="truncate text-xs text-zinc-600">
          {booking.businessName}
          {telHref && (
            <>
              {" · "}
              <a href={telHref} className="text-zinc-400 hover:text-zinc-200">
                {booking.customerMobile}
              </a>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium text-zinc-200">
          ₹{amount.toLocaleString("en-IN")}
        </span>
        {!cancelled && (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Paid
          </span>
        )}
      </div>
    </li>
  );
}
