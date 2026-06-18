"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getCustomerBookingStatus } from "@/lib/api";
import { invalidateCustomerBookings } from "@/lib/swr-hooks";

function PaymentStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") || searchParams.get("order_id") || "";

  const [status, setStatus] = useState<"loading" | "confirmed" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("Checking your payment…");
  const [businessName, setBusinessName] = useState("");

  useEffect(() => {
    if (!bookingId) {
      setStatus("failed");
      setMessage("Missing booking reference. Please try booking again.");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      attempts += 1;
      try {
        const booking = await getCustomerBookingStatus(bookingId);
        if (cancelled) return;
        setBusinessName(booking.businessName);

        if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
          setStatus("confirmed");
          setMessage("Payment received — your slot is booked.");
          invalidateCustomerBookings();
          return;
        }

        if (
          booking.status === "payment_failed" ||
          booking.status === "expired" ||
          booking.paymentStatus === "failed"
        ) {
          setStatus("failed");
          setMessage(
            booking.status === "expired"
              ? "Payment window expired. The slot was released — please book again."
              : "Payment did not go through. Please try again.",
          );
          return;
        }

        if (attempts >= maxAttempts) {
          setStatus("pending");
          setMessage("Payment is still processing. Check My bookings in a minute.");
          return;
        }

        setStatus("loading");
        setMessage("Waiting for payment confirmation…");
        window.setTimeout(() => void poll(), 2000);
      } catch {
        if (cancelled) return;
        if (attempts >= maxAttempts) {
          setStatus("failed");
          setMessage("Could not verify payment. Check My bookings or contact support.");
          return;
        }
        window.setTimeout(() => void poll(), 2000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="glass rounded-2xl p-8 text-center">
        {status === "loading" && (
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
        )}
        {status === "confirmed" && (
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-2xl">
            ✓
          </div>
        )}
        {(status === "failed" || status === "pending") && (
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-2xl">
            {status === "pending" ? "…" : "!"}
          </div>
        )}

        <h1 className="text-xl font-semibold text-zinc-100">
          {status === "confirmed"
            ? "Booking confirmed"
            : status === "failed"
              ? "Payment not completed"
              : status === "pending"
                ? "Still processing"
                : "Confirming payment"}
        </h1>
        {businessName && status === "confirmed" && (
          <p className="mt-2 text-sm text-zinc-400">{businessName}</p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{message}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {status === "confirmed" && (
            <Link
              href="/customer?view=bookings"
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              View my bookings
            </Link>
          )}
          {(status === "failed" || status === "pending") && (
            <>
              <button
                type="button"
                onClick={() => router.push("/customer")}
                className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                Back to Discover
              </button>
              <Link
                href="/customer?view=bookings"
                className="rounded-full border border-white/10 px-6 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                My bookings
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-zinc-500">Loading…</p>
        </div>
      }
    >
      <PaymentStatusContent />
    </Suspense>
  );
}
