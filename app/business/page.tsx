"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { loadVendorBusinesses } from "@/lib/vendor-businesses";

export default function VendorDashboardPage() {
  const { user, kyc, kycVerified, loading } = useVendorShell();
  const userId = user?.id ?? user?._id ?? "";
  const [businessCount, setBusinessCount] = useState(0);

  const kycStatus = kyc?.status ?? "pending";

  useEffect(() => {
    if (userId) setBusinessCount(loadVendorBusinesses(userId).length);
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading dashboard…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          <span className="text-gradient">Welcome, {user?.name || "Vendor"}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Get your Ruxstar Card first, then onboard your businesses.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Ruxstar Card</p>
          <p className="mt-2 text-lg font-semibold capitalize">
            {kycVerified ? "Active" : kycStatus.replace(/_/g, " ")}
          </p>
          <Link
            href="/business/kyc"
            className="mt-2 inline-block text-xs text-amber-200 hover:underline"
          >
            {kycVerified ? "View card →" : "Get your card →"}
          </Link>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
          <p className="mt-2 text-3xl font-semibold">{businessCount}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {kycVerified ? "On your account" : "Unlocks with your card"}
          </p>
        </div>
      </div>

      {!kycVerified && (
        <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-lg font-medium text-amber-100">Get your Ruxstar Card to start onboarding</h2>
          <p className="mt-2 max-w-xl text-sm text-amber-200/80">
            Verify your identity (Aadhaar, PAN and selfie) to unlock your Ruxstar Card before you can
            add businesses. Use the sidebar to open <strong className="font-medium">Ruxstar Card</strong>.
          </p>
          {kyc?.rejectReason && (
            <p className="mt-3 text-sm text-red-200/90">Rejection reason: {kyc.rejectReason}</p>
          )}
          <Link
            href="/business/kyc"
            className="btn-primary mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {kycStatus === "rejected"
              ? "Fix verification"
              : kycStatus === "in_progress"
                ? "Continue verification"
                : kycStatus === "pending_review"
                  ? "View card status"
                  : "Get your Ruxstar Card"}
          </Link>
        </section>
      )}

      {kycVerified && businessCount === 0 && (
        <section className="mt-8 glass rounded-2xl p-8 text-center">
          <p className="text-4xl">🏪</p>
          <h2 className="mt-4 text-lg font-medium">Your Ruxstar Card is active — add a business</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            You&apos;re verified. Head to My businesses in the sidebar to onboard your first one.
          </p>
          <Link
            href="/business/businesses"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Go to My businesses
          </Link>
        </section>
      )}
    </div>
  );
}
