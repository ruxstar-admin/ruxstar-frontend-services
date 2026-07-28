"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { CustomerBackLink } from "@/components/customer-shell";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { bookCreatorOffer, getPublicCreatorOffer } from "@/lib/api";
import { invalidateMyCreatorBookings } from "@/lib/swr-hooks";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const kindLabel = (kind: string) => {
  if (kind === "shoutout") return "Shoutout";
  if (kind === "appearance") return "Appearance";
  return "Collab";
};

export default function CustomerCreatorOfferPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = String(params.offerId ?? "");

  const { data: offer, isLoading, error } = useSWR(`public/creator-offers/${offerId}`, () =>
    getPublicCreatorOffer(offerId),
  );

  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  const full = offer?.spotsLeft === 0;

  async function handleBook() {
    if (!offer) return;
    setFormError("");
    if (!brief.trim()) {
      setFormError("Describe what you need for this collab.");
      return;
    }
    setSubmitting(true);
    try {
      const { payment } = await bookCreatorOffer(offerId, { brief: brief.trim() });
      await invalidateMyCreatorBookings();
      if (payment) {
        await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
        return;
      }
      setDone(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not start booking.");
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-5">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="px-5">
        <CustomerBackLink />
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-sm text-zinc-400">This offer isn&apos;t available.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-5">
        <div className="glass mx-auto max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-semibold">Booking confirmed!</h1>
          <p className="mt-2 text-sm text-zinc-400">{offer.title}</p>
          <Link
            href="/customer?view=bookings"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            View my bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-8">
      <CustomerBackLink />

      <div className="overflow-hidden rounded-3xl border border-white/8">
        <div className="relative h-48 w-full bg-gradient-to-br from-pink-500/20 via-white/5 to-transparent sm:h-56">
          {offer.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-6xl opacity-80">✨</div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-100 backdrop-blur">
            {kindLabel(offer.kind)}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{offer.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">by {offer.businessName}</p>
          {offer.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
              {offer.description}
            </p>
          )}
          {offer.platforms.length > 0 && (
            <p className="mt-4 text-xs text-zinc-500">
              Platforms: {offer.platforms.join(", ")}
            </p>
          )}
          {offer.turnaroundDays != null && (
            <p className="mt-1 text-xs text-zinc-500">
              Typical turnaround: {offer.turnaroundDays} day{offer.turnaroundDays === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="glass h-fit rounded-2xl p-5">
          <p className="text-2xl font-semibold text-emerald-300">{money(offer.price)}</p>
          <p className="mt-1 text-xs text-zinc-500">Pay securely via Ruxstar</p>

          {full ? (
            <p className="mt-4 text-sm text-zinc-500">This offer is full right now.</p>
          ) : (
            <>
              <textarea
                className="field-input mt-4 min-h-[6rem] resize-none text-sm"
                placeholder="Your brief — what should the creator deliver?"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
              {formError && (
                <p className="mt-2 text-sm text-red-200">{formError}</p>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleBook()}
                className="btn-primary mt-4 w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "Opening checkout…" : "Pay & book"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
