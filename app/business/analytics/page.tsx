"use client";

import Link from "next/link";
import { useVendorShell } from "@/components/vendor-shell";

export default function VendorAnalyticsPage() {
  const { kycVerified } = useVendorShell();

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
          <p className="mt-2 text-sm text-zinc-400">Analytics unlock after identity verification.</p>
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Go to KYC verification
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Analytics</p>
      <h1 className="mt-1 text-2xl font-semibold">Performance insights</h1>
      <div className="mt-8 glass rounded-2xl p-10 text-center">
        <p className="text-sm text-zinc-500">Revenue and business metrics — coming soon.</p>
      </div>
    </div>
  );
}
