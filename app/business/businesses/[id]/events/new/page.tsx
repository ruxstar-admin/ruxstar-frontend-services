"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { useVendorShell } from "@/components/vendor-shell";
import { VendorEventWizard } from "@/components/vendor-event-wizard";
import { invalidateVendorEvents } from "@/lib/swr-hooks";
import { getBusiness } from "@/lib/api";
import { defaultEventKindForBusiness, supportsEvents } from "@/lib/business-setup";

export default function NewBusinessEventPage() {
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

  if (business && !supportsEvents(business.module)) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-sm text-zinc-400">This business doesn&apos;t host events.</p>
          <Link
            href="/business/businesses"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Back to businesses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="shrink-0">
        <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← My businesses
        </Link>
        <p className="mt-2 text-sm text-zinc-500">
          {business
            ? defaultEventKindForBusiness(business) === "tournament"
              ? "Set up your tournament step by step."
              : "Set up your event step by step."
            : "Set up step by step."}
        </p>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {business && (
          <VendorEventWizard
            mode="create"
            businessId={businessId}
            businessName={business.name}
            eventKind={defaultEventKindForBusiness(business)}
            businessTypeLabel={business.typeLabel}
            onDone={async (event) => {
              await invalidateVendorEvents();
              router.push(`/business/businesses/${businessId}/events/${event.id}`);
            }}
            onCancel={() => router.push("/business/businesses")}
          />
        )}
      </div>
    </div>
  );
}
