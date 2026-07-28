"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { VendorCreatorOfferForm } from "@/components/vendor-creator-offer-form";
import { useVendorShell } from "@/components/vendor-shell";
import { createVendorCreatorOffer, getBusiness, publishCreatorOffer } from "@/lib/api";
import { supportsCreatorSetup } from "@/lib/business-setup";
import { invalidateVendorCreatorOffers } from "@/lib/swr-hooks";

export default function NewCreatorOfferPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = typeof params.id === "string" ? params.id : "";
  const { kycVerified } = useVendorShell();

  const { data: business, isLoading } = useSWR(
    kycVerified && businessId ? `business/${businessId}` : null,
    () => getBusiness(businessId),
  );

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

  if (isLoading) {
    return <div className="glass h-full w-full animate-pulse rounded-2xl" />;
  }

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
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
      <Link
        href={`/business/businesses/${businessId}/offers`}
        className="text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Offers
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-zinc-100">New collab offer</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Published offers show up in customer Discover. Payment is via Ruxstar only.
      </p>
      <div className="glass mt-6 rounded-2xl p-5">
        <VendorCreatorOfferForm
          businessId={businessId}
          onCancel={() => router.push(`/business/businesses/${businessId}/offers`)}
          onSubmit={async (body, { publish }) => {
            const offer = await createVendorCreatorOffer(body);
            if (publish) await publishCreatorOffer(offer.id);
            await invalidateVendorCreatorOffers();
            router.push(`/business/businesses/${businessId}/offers`);
          }}
        />
      </div>
    </div>
  );
}
