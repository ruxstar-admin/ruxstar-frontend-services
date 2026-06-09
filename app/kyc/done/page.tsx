"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Particles } from "@/components/particles";
import { getToken, isAadhaarVerified, syncAadhaarKyc } from "@/lib/api";

export default function KycDonePage() {
  const router = useRouter();
  const [message, setMessage] = useState("Syncing your Aadhaar verification…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function sync() {
      const maxAttempts = 12;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelled) return;
        try {
          const data = await syncAadhaarKyc();
          if (isAadhaarVerified(data)) {
            router.replace("/business/kyc");
            return;
          }
        } catch {
          // keep polling briefly after DigiLocker redirect
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!cancelled) {
        setFailed(true);
        setMessage("We couldn't confirm Aadhaar yet. Return to KYC and try syncing again.");
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
      </div>
      <Particles />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6">
        <div className="glass w-full rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold">
            <span className="text-gradient">{failed ? "Almost there" : "Welcome back"}</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">{message}</p>
          {!failed && (
            <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          )}
          {failed && (
            <Link
              href="/business/kyc"
              className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              Back to KYC
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
