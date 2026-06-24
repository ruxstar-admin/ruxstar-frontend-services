"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { supportsAppointmentSetup } from "@/lib/business-setup";
import { useVendorBookings, useVendorBusinesses } from "@/lib/swr-hooks";
import {
  bookingAmount,
  computeVendorMetrics,
  formatINR,
  isPaid,
  paymentTime,
} from "@/lib/vendor-metrics";
import type { VendorBooking } from "@/lib/api";

type Filter = "paid" | "upcoming" | "refunded" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "upcoming", label: "Upcoming" },
  { id: "refunded", label: "Refunded" },
  { id: "all", label: "All" },
];

function txDateLabel(b: VendorBooking) {
  return new Date(paymentTime(b)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function txTimeLabel(b: VendorBooking) {
  return new Date(paymentTime(b)).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default function VendorPaymentsPage() {
  const { kycVerified } = useVendorShell();
  const { data, isLoading, error } = useVendorBookings(kycVerified);
  const { data: businesses = [] } = useVendorBusinesses(kycVerified);
  const [filter, setFilter] = useState<Filter>("paid");
  const [businessId, setBusinessId] = useState<string>("all");

  const bookings = useMemo(() => data ?? [], [data]);
  const metrics = useMemo(() => computeVendorMetrics(bookings), [bookings]);

  const appointmentBusinesses = useMemo(
    () => businesses.filter((b) => supportsAppointmentSetup(b.module)),
    [businesses],
  );
  const showBusinessFilter = appointmentBusinesses.length > 1;
  const activeBusinessId =
    businessId !== "all" && appointmentBusinesses.some((b) => b.id === businessId)
      ? businessId
      : "all";

  const rows = useMemo(() => {
    const now = Date.now();
    let list = bookings;
    if (activeBusinessId !== "all") list = list.filter((b) => b.businessId === activeBusinessId);
    list = list.filter((b) => {
      switch (filter) {
        case "paid":
          return isPaid(b);
        case "upcoming":
          return isPaid(b) && new Date(b.startAt).getTime() > now;
        case "refunded":
          return b.status === "cancelled";
        case "all":
        default:
          return true;
      }
    });
    // Most recent transaction first.
    return [...list].sort((a, b) => paymentTime(b) - paymentTime(a));
  }, [bookings, filter, activeBusinessId]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Payments unlock after identity verification.
          </p>
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
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500">Payments</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Earnings & transactions</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Every settled payment from your bookings, newest first.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total earned" value={formatINR(metrics.totalRevenue)} accent />
        <SummaryCard label="This month" value={formatINR(metrics.monthRevenue)} />
        <SummaryCard label="Transactions" value={String(metrics.paidCount)} />
        <SummaryCard label="Upcoming" value={formatINR(metrics.upcomingRevenue)} />
      </div>

      <div className="mt-6 flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="field-input h-9 w-full py-0 text-sm text-zinc-100 sm:w-44"
          aria-label="Filter payments"
        >
          {FILTERS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        {showBusinessFilter && (
          <select
            value={activeBusinessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="field-input h-9 w-full py-0 text-sm text-zinc-100 sm:w-52"
            aria-label="Filter by business"
          >
            <option value="all">All businesses</option>
            {appointmentBusinesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8 text-center text-sm text-red-300">
            Couldn&apos;t load payments. Please refresh.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-3xl">💳</p>
            <p className="mt-3 text-sm text-zinc-300">
              {filter === "refunded"
                ? "No refunds yet."
                : filter === "upcoming"
                  ? "No upcoming paid bookings."
                  : "No payments yet. They'll appear here once customers book."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((b) => (
              <PaymentRow key={b.id} booking={b} showBusiness={activeBusinessId === "all"} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}

function PaymentRow({
  booking,
  showBusiness,
}: {
  booking: VendorBooking;
  showBusiness: boolean;
}) {
  const refunded = booking.status === "cancelled";
  const amount = bookingAmount(booking);
  const detail =
    booking.serviceLabel || booking.resourceName || booking.typeLabel || "Booking";

  return (
    <li className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm ${
          refunded
            ? "bg-red-400/10 text-red-300"
            : "bg-emerald-400/10 text-emerald-300"
        }`}
        aria-hidden
      >
        {refunded ? "↩" : "₹"}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-50">{booking.customerName || "Customer"}</p>
        <p className="truncate text-xs text-zinc-400">
          {showBusiness && booking.businessName ? `${booking.businessName} · ` : ""}
          {detail}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {txDateLabel(booking)} · {txTimeLabel(booking)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-sm font-semibold ${refunded ? "text-zinc-500 line-through" : "text-zinc-100"}`}
        >
          {formatINR(amount)}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            refunded
              ? "border-red-400/25 bg-red-400/10 text-red-300"
              : "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          }`}
        >
          {refunded ? "Refunded" : "Paid"}
        </span>
      </div>
    </li>
  );
}
