"use client";

import Link from "next/link";
import { useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { updateVendorCreatorBookingStatus, type CreatorBooking } from "@/lib/api";
import {
  invalidateVendorCreatorBookings,
  useVendorCreatorBookings,
} from "@/lib/swr-hooks";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const NEXT: Record<string, "in_progress" | "completed" | null> = {
  confirmed: "in_progress",
  in_progress: "completed",
};

export default function VendorCreatorBookingsPage() {
  const { kycVerified } = useVendorShell();
  const { data: bookings = [], isLoading, mutate } = useVendorCreatorBookings(kycVerified);
  const [busyId, setBusyId] = useState("");

  async function advance(b: CreatorBooking) {
    const next = NEXT[b.status];
    if (!next) return;
    setBusyId(b.id);
    try {
      await updateVendorCreatorBookingStatus(b.id, next);
      await mutate();
      await invalidateVendorCreatorBookings();
    } finally {
      setBusyId("");
    }
  }

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← My businesses
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">
        <span className="text-gradient">Creator bookings</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Paid collab requests from customers.</p>

      <div className="scroll-pane mt-6 min-h-0 flex-1 space-y-3 pb-4">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-zinc-500">No bookings yet.</p>
          </div>
        ) : (
          bookings.map((b) => {
            const next = NEXT[b.status];
            return (
              <article
                key={b.id}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{b.offerTitle}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {b.customerName} · {b.businessName} · {money(b.amount)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">{b.brief}</p>
                    <p className="mt-2 text-xs capitalize text-zinc-600">Status: {b.status.replace(/_/g, " ")}</p>
                  </div>
                  {next && (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void advance(b)}
                      className="btn-primary shrink-0 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {busyId === b.id
                        ? "Saving…"
                        : next === "in_progress"
                          ? "Start work"
                          : "Mark completed"}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
