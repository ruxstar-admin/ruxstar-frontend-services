"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BusinessSetupWizard } from "@/components/business-setup-wizard";
import { useVendorShell } from "@/components/vendor-shell";
import { businessThumbnailUrl, type Business, getBusinessSetup } from "@/lib/api";
import { supportsAppointmentSetup } from "@/lib/business-setup";

export default function BusinessSetupPage() {
  const params = useParams();
  const router = useRouter();
  const { kycVerified } = useVendorShell();
  const businessId = typeof params.id === "string" ? params.id : "";

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError("");
    try {
      setBusiness(await getBusinessSetup(businessId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load business.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (kycVerified && businessId) load();
    else setLoading(false);
  }, [kycVerified, businessId, load]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <Link href="/business/kyc" className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold">
            Get your Ruxstar Card
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="glass h-full w-full animate-pulse rounded-2xl" />;
  }

  if (error || !business) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-sm text-red-200">{error || "Business not found."}</p>
          <Link href="/business/businesses" className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold">
            Back to businesses
          </Link>
        </div>
      </div>
    );
  }

  if (!supportsAppointmentSetup(business.module)) {
    const thumbUrl = businessThumbnailUrl(business);
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← My businesses
        </Link>
        <div className="mt-6 glass rounded-2xl p-10 text-center">
          {thumbUrl && (
            <div className="mx-auto mb-4 h-24 w-32 overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <p className="text-4xl">🚧</p>
          <h1 className="mt-4 text-xl font-semibold">{business.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {business.categoryLabel} · {business.typeLabel}
          </p>
          {business.description && (
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">{business.description}</p>
          )}
          <p className="mt-4 text-sm text-zinc-400">
            Your profile is saved. Booking setup for{" "}
            <strong className="font-medium text-zinc-300">{business.typeLabel}</strong> is coming
            soon — turf, salon, venues, and clinics are live first.
          </p>
        </div>
      </div>
    );
  }

  if (business.setupComplete) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="shrink-0">
          <Link
            href={`/business/businesses/${business.id}/calendar`}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Slot calendar
          </Link>
          <p className="mt-2 text-sm text-zinc-500">
            {business.setup?.bookingMode === "fullDay"
              ? "Update rules, photos, open days, halls, and daily price."
              : "Update photos, hours, resources, and pricing."}
          </p>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <BusinessSetupWizard
            business={business}
            editMode
            onComplete={(updated) => {
              setBusiness(updated);
              router.push(`/business/businesses/${updated.id}/calendar`);
            }}
          />
        </div>
      </div>
    );
  }

  if (!business.setup) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-sm text-zinc-500">Setup data not available. Try refreshing.</p>
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
          Profile saved. Complete setup below to open bookings.
        </p>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <BusinessSetupWizard
          business={business}
          onComplete={(updated) => {
            setBusiness(updated);
            router.push(`/business/businesses/${updated.id}/calendar`);
          }}
        />
      </div>
    </div>
  );
}
