"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { LogoutButton } from "@/components/logout-button";
import { Particles } from "@/components/particles";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  getVendorKycStatus,
  kycStepVisual,
  nextKycStep,
  startAadhaarKyc,
  syncAadhaarKyc,
  type VendorKycStatus,
  verifyFaceKyc,
  verifyPanKyc,
} from "@/lib/api";

function stepDone(step?: { status?: string; verified?: boolean }) {
  return step?.verified === true || step?.status === "verified";
}

const input = "field-input";

const steps = [
  { id: "aadhaar", label: "Aadhaar", hint: "Verify via DigiLocker" },
  { id: "pan", label: "PAN", hint: "Enter your PAN number" },
  { id: "face", label: "Selfie", hint: "Match your Aadhaar photo" },
] as const;

export default function VendorKycPage() {
  const router = useRouter();
  const { ready: authReady } = useRequireAuth({ roles: ["vendor"] });
  const [kyc, setKyc] = useState<VendorKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pan, setPan] = useState("");

  const currentStep = nextKycStep(kyc);

  const refresh = useCallback(async () => {
    const data = await getVendorKycStatus();
    setKyc(data);
    if (data.status === "verified") {
      router.replace("/business");
    }
    return data;
  }, [router]);

  useEffect(() => {
    if (!authReady) return;

    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KYC status"))
      .finally(() => setLoading(false));
  }, [authReady, refresh]);

  async function onStartAadhaar() {
    setError("");
    setBusy(true);
    try {
      const redirectUrl = `${window.location.origin}/kyc/done`;
      const res = await startAadhaarKyc(redirectUrl);
      if (!res.url) throw new Error("DigiLocker link was not returned.");
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Aadhaar verification");
      setBusy(false);
    }
  }

  async function onSyncAadhaar() {
    setError("");
    setBusy(true);
    try {
      const data = await syncAadhaarKyc();
      setKyc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aadhaar sync failed — complete DigiLocker first");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyPan(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
      setError("Enter a valid PAN (e.g. ABCPV1234D).");
      return;
    }

    setBusy(true);
    try {
      const data = await verifyPanKyc(value);
      setKyc(data);
      setPan("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PAN verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyFace(base64: string) {
    setError("");
    setBusy(true);
    try {
      const data = await verifyFaceKyc(base64);
      setKyc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face verification failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/50">Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid absolute inset-0" />
        <div className="spotlight absolute inset-0" />
        <div className="grade-overlay absolute inset-0" />
      </div>
      <Particles />

      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/business" className="text-lg font-semibold tracking-tight">
          Ruxstar Business
        </Link>
        <LogoutButton />
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-16">
        <div className="glass rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Vendor onboarding</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            <span className="text-gradient">Complete your KYC</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Verify your identity to unlock your business dashboard. All three steps are required.
          </p>

          {loading ? (
            <p className="mt-10 text-center text-sm text-zinc-500">Loading verification status…</p>
          ) : currentStep === "review" ? (
            <div className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-6 text-center">
              <p className="text-lg font-medium text-emerald-100">Submitted for review</p>
              <p className="mt-2 text-sm text-emerald-100/80">
                Your documents are with our team. You&apos;ll get full access once approved.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  refresh()
                    .catch((err) => setError(err instanceof Error ? err.message : "Could not refresh"))
                    .finally(() => setLoading(false));
                }}
                className="btn-primary mt-6 rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                Check status
              </button>
            </div>
          ) : (
            <>
              {kyc?.status === "rejected" && (
                <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-5">
                  <p className="text-lg font-medium text-red-100">KYC rejected</p>
                  <p className="mt-2 text-sm text-red-100/80">
                    {kyc.rejectReason ?? kyc.reason ?? "Your submission was not approved."}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    Update the step below and submit again — usually a new selfie or corrected PAN.
                  </p>
                </div>
              )}

              <ol className={`flex gap-2 ${kyc?.status === "rejected" ? "mt-6" : "mt-8"}`}>
                {steps.map((step) => {
                  const visual = kycStepVisual(step.id, kyc, currentStep);
                  return (
                    <li key={step.id} className="flex-1">
                      <div
                        className={`rounded-lg border px-3 py-3 text-center text-xs transition ${
                          visual === "done"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            : visual === "active"
                              ? "border-white/20 bg-white/10 text-zinc-100"
                              : "border-white/5 bg-white/5 text-zinc-500"
                        }`}
                      >
                        <span className="block font-medium">{step.label}</span>
                        <span className="mt-0.5 block opacity-70">
                          {visual === "done" ? "Done" : step.hint}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {error && (
                <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              )}

              <div className="mt-8">
                {currentStep === "aadhaar" && (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400">
                      You&apos;ll be redirected to DigiLocker (government portal) to verify your
                      real Aadhaar with OTP and consent — not a manual ID upload.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onStartAadhaar}
                      className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
                    >
                      {busy ? "Opening DigiLocker…" : "Verify Aadhaar with DigiLocker"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onSyncAadhaar}
                      className="w-full rounded-full border border-white/10 py-3 text-sm transition hover:bg-white/5 disabled:opacity-60"
                    >
                      {busy ? "Syncing…" : "I finished on DigiLocker — sync now"}
                    </button>
                  </div>
                )}

                {currentStep === "pan" && (
                  <form onSubmit={onVerifyPan} className="space-y-4">
                    {kyc?.status === "rejected" && stepDone(kyc.pan) && (
                      <p className="text-sm text-zinc-400">
                        Re-enter your PAN if the admin asked you to correct it.
                      </p>
                    )}
                    <label className="block text-sm text-zinc-400">
                      PAN number
                      <input
                        className={`${input} mt-2 uppercase tracking-wider`}
                        value={pan}
                        maxLength={10}
                        autoComplete="off"
                        onChange={(e) => {
                          setError("");
                          setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                        }}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
                    >
                      {busy ? "Verifying…" : kyc?.status === "rejected" ? "Resubmit PAN" : "Verify PAN"}
                    </button>
                  </form>
                )}

                {currentStep === "face" && (
                  <div className="space-y-4">
                    {kyc?.status === "rejected" && (
                      <p className="text-sm text-amber-100/90">
                        Take a new live selfie to resubmit your KYC for admin review.
                      </p>
                    )}
                    <FaceCapture disabled={busy} onCapture={onVerifyFace} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
