"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getCustomerBookingStatus, getEventRegistrationStatus } from "@/lib/api";
import { invalidateCustomerBookings, invalidateMyEventRegistrations } from "@/lib/swr-hooks";

// The Cashfree return URL carries the order id (a booking id OR an event
// registration id). Probe the booking endpoint first; if it 404s, treat the id
// as an event registration. Both expose { status, paymentStatus }.
type StatusEntity = {
  kind: "booking" | "event";
  title: string;
  status: string;
  paymentStatus?: string | null;
};

async function fetchStatus(id: string): Promise<StatusEntity | null> {
  try {
    const b = await getCustomerBookingStatus(id);
    return { kind: "booking", title: b.businessName, status: b.status, paymentStatus: b.paymentStatus };
  } catch {
    try {
      const r = await getEventRegistrationStatus(id);
      return { kind: "event", title: r.eventTitle, status: r.status, paymentStatus: r.paymentStatus };
    } catch {
      return null;
    }
  }
}

function PaymentStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") || searchParams.get("order_id") || "";

  const [status, setStatus] = useState<"loading" | "confirmed" | "failed" | "pending">("loading");
  const [message, setMessage] = useState("Checking your payment…");
  const [businessName, setBusinessName] = useState("");
  const [kind, setKind] = useState<"booking" | "event">("booking");

  useEffect(() => {
    if (!bookingId) {
      setStatus("failed");
      setMessage("Missing payment reference. Please try again.");
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    const poll = async () => {
      attempts += 1;
      const entity = await fetchStatus(bookingId);
      if (cancelled) return;

      if (entity) {
        setBusinessName(entity.title);
        setKind(entity.kind);
        const isEvent = entity.kind === "event";

        if (entity.status === "confirmed" && entity.paymentStatus === "paid") {
          setStatus("confirmed");
          setMessage(
            isEvent ? "Payment received — you're registered." : "Payment received — your slot is booked.",
          );
          if (isEvent) invalidateMyEventRegistrations();
          else invalidateCustomerBookings();
          return;
        }

        if (
          entity.status === "payment_failed" ||
          entity.status === "expired" ||
          entity.paymentStatus === "failed"
        ) {
          setStatus("failed");
          setMessage(
            entity.status === "expired"
              ? "Payment window expired — your spot was released. Please try again."
              : "Payment did not go through. Please try again.",
          );
          return;
        }
      }

      if (attempts >= maxAttempts) {
        setStatus("pending");
        setMessage("Payment is still processing. Check My bookings in a minute.");
        return;
      }

      setStatus("loading");
      setMessage("Waiting for payment confirmation…");
      window.setTimeout(() => void poll(), 2000);
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
            ? kind === "event"
              ? "Registration confirmed"
              : "Booking confirmed"
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
