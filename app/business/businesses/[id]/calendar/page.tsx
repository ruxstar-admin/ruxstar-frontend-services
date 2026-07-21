"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BusinessSlotCalendar } from "@/components/business-slot-calendar";
import { CoachingClassesBoard } from "@/components/coaching-classes-board";
import { ServiceAppointmentsBoard } from "@/components/service-appointments-board";
import { useVendorShell } from "@/components/vendor-shell";
import { type Business, getBusiness } from "@/lib/api";
import { isServiceSetup, supportsAppointmentSetup } from "@/lib/business-setup";

export default function BusinessCalendarPage() {
  const params = useParams();
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
      setBusiness(await getBusiness(businessId));
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
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
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

  if (!supportsAppointmentSetup(business.module)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← My businesses
        </Link>
        <div className="mt-6 glass rounded-2xl p-10 text-center">
          <p className="text-sm text-zinc-400">Slot calendar is not available for this business type yet.</p>
        </div>
      </div>
    );
  }

  if (!business.setupComplete) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← My businesses
        </Link>
        <div className="mt-6 glass rounded-2xl p-10 text-center">
          <h1 className="text-lg font-semibold">{business.name}</h1>
          <p className="mt-2 text-sm text-zinc-400">Finish setup before managing your slot calendar.</p>
          <Link
            href={`/business/businesses/${business.id}/setup`}
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Continue setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Link href="/business/businesses" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← My businesses
        </Link>
        <Link
          href={`/business/businesses/${business.id}/setup`}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Edit setup
        </Link>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {isServiceSetup(business.typeId) ? (
          business.typeId === "coaching" ? (
            <CoachingClassesBoard business={business} />
          ) : (
            <ServiceAppointmentsBoard businessId={business.id} />
          )
        ) : (
          <BusinessSlotCalendar businessId={business.id} businessName={business.name} />
        )}
      </div>
    </div>
  );
}
