"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BusinessSetupWizard } from "@/components/business-setup-wizard";
import { useVendorShell } from "@/components/vendor-shell";
import {
  businessThumbnailUrl,
  type Business,
  getBusinessSetup,
  updateBusinessSetup,
} from "@/lib/api";
import {
  bookingModeLabel,
  needsBookingModeOnCreate,
  supportsCommerceSetup,
  supportsCreatorSetup,
  supportsEvents,
  supportsPrintSetup,
  supportsSetup,
  type BookingMode,
} from "@/lib/business-setup";

export default function BusinessSetupPage() {
  const params = useParams();
  const router = useRouter();
  const { kycVerified } = useVendorShell();
  const businessId = typeof params.id === "string" ? params.id : "";

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modeBusy, setModeBusy] = useState(false);
  const [modeError, setModeError] = useState("");

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

  // Events businesses don't use appointment setup — send them straight to events.
  if (supportsEvents(business.module)) {
    router.replace(`/business/businesses/${businessId}/events/new`);
    return <div className="glass h-full w-full animate-pulse rounded-2xl" />;
  }

  async function onChangeBookingMode(mode: BookingMode) {
    if (!business || business.setup?.bookingMode === mode) return;
    setModeBusy(true);
    setModeError("");
    try {
      setBusiness(await updateBusinessSetup(business.id, { bookingMode: mode }));
    } catch (err) {
      setModeError(err instanceof Error ? err.message : "Could not change booking style.");
    } finally {
      setModeBusy(false);
    }
  }

  const isPrint = supportsPrintSetup(business.module, business.typeId);
  const isCommerce = supportsCommerceSetup(business.module);
  const isCreator = supportsCreatorSetup(business.module);
  const canSwitchBookingMode = needsBookingModeOnCreate(business.typeId);
  const currentMode: BookingMode = business.setup?.bookingMode === "fullDay" ? "fullDay" : "slots";

  const bookingModeSwitcher = canSwitchBookingMode ? (
    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Booking style</span>
        {(["slots", "fullDay"] as BookingMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChangeBookingMode(mode)}
            disabled={modeBusy}
            className={`rounded-full border px-3.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              currentMode === mode
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {bookingModeLabel(mode)}
          </button>
        ))}
        {modeBusy && <span className="text-xs text-zinc-500">Saving…</span>}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        Only changeable while you have no upcoming bookings. Review your hours and pricing after
        switching.
      </p>
      {modeError && <p className="mt-1.5 text-xs text-red-300">{modeError}</p>}
    </div>
  ) : null;
  const doneHref = isPrint
    ? "/business/print-orders"
    : isCommerce
      ? "/business/commerce-orders"
      : isCreator
        ? `/business/businesses/${business.id}/offers`
        : `/business/businesses/${business.id}/calendar`;

  if (!supportsSetup(business.module, business.typeId)) {
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
          <Link href={doneHref} className="text-sm text-zinc-500 hover:text-zinc-300">
            {isPrint || isCommerce || isCreator ? "← Back" : "← Slot calendar"}
          </Link>
          <p className="mt-2 text-sm text-zinc-500">
            {isPrint
              ? "Update your print categories, service area, and pricing."
              : isCommerce
                ? "Update your shop details, products, prices, and stock."
                : isCreator
                  ? "Update your creator profile and photos."
                  : business.setup?.bookingMode === "fullDay"
                  ? "Update rules, photos, open days, halls, and daily price."
                  : "Update photos, hours, resources, and pricing."}
          </p>
          {bookingModeSwitcher}
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <BusinessSetupWizard
            business={business}
            editMode
            onComplete={(updated) => {
              setBusiness(updated);
              router.push(doneHref);
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
          {isPrint
            ? "Profile saved. Complete setup below to start receiving print orders."
            : isCommerce
              ? "Profile saved. Add your products below to open your shop."
              : isCreator
                ? "Profile saved. Complete setup, then publish collab offers."
                : "Profile saved. Complete setup below to open bookings."}
        </p>
        {bookingModeSwitcher}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <BusinessSetupWizard
          business={business}
          onComplete={(updated) => {
            setBusiness(updated);
            router.push(doneHref);
          }}
        />
      </div>
    </div>
  );
}
