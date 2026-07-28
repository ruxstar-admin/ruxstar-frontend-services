"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useVendorShell } from "@/components/vendor-shell";
import {
  cancelCreatorOffer,
  getBusiness,
  publishCreatorOffer,
  unpublishCreatorOffer,
} from "@/lib/api";
import { supportsCreatorSetup } from "@/lib/business-setup";
import { invalidateVendorCreatorOffers, useVendorCreatorOffers } from "@/lib/swr-hooks";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function BusinessCreatorOffersPage() {
  const params = useParams();
  const businessId = typeof params.id === "string" ? params.id : "";
  const { kycVerified } = useVendorShell();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const { data: business, isLoading: bizLoading } = useSWR(
    kycVerified && businessId ? `business/${businessId}` : null,
    () => getBusiness(businessId),
  );
  const { data: offers = [], isLoading, mutate } = useVendorCreatorOffers(
    kycVerified && !!businessId,
    businessId,
  );

  async function setStatus(id: string, action: "publish" | "unpublish" | "cancel") {
    setBusyId(id);
    setError("");
    try {
      if (action === "publish") await publishCreatorOffer(id);
      else if (action === "unpublish") await unpublishCreatorOffer(id);
      else await cancelCreatorOffer(id);
      await mutate();
      await invalidateVendorCreatorOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} this offer.`);
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

  if (bizLoading || isLoading) {
    return <div className="glass h-full w-full animate-pulse rounded-2xl" />;
  }

  const publishedCount = offers.filter((o) => o.status === "published").length;

  if (business && !supportsCreatorSetup(business.module)) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-zinc-400">This business is not a creator profile.</p>
        <Link href="/business/businesses" className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← My businesses
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">{business?.name ?? "Offers"}</h1>
          <p className="mt-1 text-sm text-zinc-500">Collab & shoutout packages customers can book.</p>
        </div>
        <Link
          href={`/business/businesses/${businessId}/offers/new`}
          className="btn-primary rounded-full px-4 py-2 text-sm font-semibold"
        >
          + New offer
        </Link>
      </div>

      <div className="scroll-pane mt-6 min-h-0 flex-1 space-y-3 pb-4">
        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}
        {offers.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-zinc-500">No offers yet. Create one to appear in Discover.</p>
          </div>
        ) : publishedCount === 0 ? (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100">
            None of your offers are published, so nothing shows in customer Discover yet.
          </p>
        ) : null}

        {offers.length > 0 && (
          offers.map((o) => (
            <article
              key={o.id}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-100">{o.title}</p>
                    <OfferStatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 capitalize">
                    {o.kind} · {money(o.price)}
                  </p>
                  {o.status === "draft" && (
                    <p className="mt-1.5 text-xs text-amber-200/80">
                      Not visible to customers yet — hit Publish to list it in Discover.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.status === "draft" && (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o.id, "publish")}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200"
                    >
                      Publish
                    </button>
                  )}
                  {o.status === "published" && (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o.id, "unpublish")}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                    >
                      Unpublish
                    </button>
                  )}
                  {o.status !== "cancelled" && (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o.id, "cancel")}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Link
        href="/business/creator-bookings"
        className="mt-4 text-center text-sm text-pink-200 hover:underline"
      >
        View collab bookings →
      </Link>
    </div>
  );
}

function OfferStatusBadge({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : status === "cancelled"
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-amber-400/25 bg-amber-400/10 text-amber-300";
  const label = status === "published" ? "Live in Discover" : status === "cancelled" ? "Cancelled" : "Draft";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
