"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { KycAadhaarVisual } from "@/components/kyc-aadhaar-visual";
import { useVendorShell } from "@/components/vendor-shell";
import {
  kycStepVisual,
  nextKycStep,
  startAadhaarKyc,
  verifyFaceKyc,
  verifyPanKyc,
  type VendorKycStatus,
} from "@/lib/api";

const input = "field-input";

function kycRedirectUrl() {
  return (
    process.env.NEXT_PUBLIC_KYC_REDIRECT_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/kyc/done` : "")
  );
}

const STEPS = [
  {
    id: "aadhaar" as const,
    number: 1,
    label: "Aadhaar",
    title: "Verify your Aadhaar",
    subtitle: "Government-verified identity via DigiLocker",
    tips: [
      "You'll be redirected to the official DigiLocker portal",
      "Enter your Aadhaar-linked mobile OTP",
      "You'll return here automatically when done",
    ],
  },
  {
    id: "pan" as const,
    number: 2,
    label: "PAN",
    title: "Verify your PAN",
    subtitle: "Income Tax Department identity check",
    tips: [
      "Enter the PAN linked to your name",
      "Format: 5 letters, 4 digits, 1 letter",
      "Must match your Aadhaar details",
    ],
  },
  {
    id: "face" as const,
    number: 3,
    label: "Selfie",
    title: "Live face verification",
    subtitle: "Match your face with Aadhaar photo",
    tips: [
      "Use good lighting and face the camera",
      "Remove glasses or hat if possible",
      "Hold still when capturing",
    ],
  },
];

function completedCount(kyc: VendorKycStatus | null) {
  let n = 0;
  if (kyc?.aadhaar?.verified || kyc?.aadhaar?.status === "verified") n++;
  if (kyc?.pan?.verified || kyc?.pan?.status === "verified") n++;
  if (kyc?.face?.verified || kyc?.face?.status === "verified") n++;
  return n;
}

function StepIndicator({
  kyc,
  currentStep,
}: {
  kyc: VendorKycStatus | null;
  currentStep: ReturnType<typeof nextKycStep>;
}) {
  return (
    <ol className="space-y-0">
      {STEPS.map((step, idx) => {
        const visual = kycStepVisual(step.id, kyc, currentStep);
        const isLast = idx === STEPS.length - 1;

        return (
          <li key={step.id} className="relative flex gap-4">
            {!isLast && (
              <span
                className={`absolute left-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-px ${
                  visual === "done" ? "bg-emerald-500/40" : "bg-white/10"
                }`}
              />
            )}
            <div
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                visual === "done"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : visual === "active"
                    ? "border-white/30 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-zinc-500"
              }`}
            >
              {visual === "done" ? "✓" : step.number}
            </div>
            <div className={`pb-8 ${isLast ? "pb-0" : ""}`}>
              <p
                className={`text-sm font-medium ${
                  visual === "active"
                    ? "text-zinc-100"
                    : visual === "done"
                      ? "text-emerald-200/90"
                      : "text-zinc-500"
                }`}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {visual === "done" ? "Completed" : visual === "active" ? "In progress" : "Pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TipsList({ tips }: { tips: string[] }) {
  return (
    <ul className="mt-5 space-y-2">
      {tips.map((tip) => (
        <li key={tip} className="flex gap-2.5 text-sm text-zinc-400">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
          {tip}
        </li>
      ))}
    </ul>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="h-8 w-64 rounded bg-white/10" />
      <div className="h-24 rounded-2xl bg-white/5" />
      <div className="h-12 rounded-full bg-white/10" />
    </div>
  );
}

export default function VendorKycPage() {
  const router = useRouter();
  const { kyc, refreshKyc, loading: shellLoading } = useVendorShell();
  const [loading, setLoading] = useState(shellLoading);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pan, setPan] = useState("");

  const currentStep = nextKycStep(kyc);
  const done = completedCount(kyc);
  const progress = Math.round((done / 3) * 100);

  const activeMeta = useMemo(() => {
    if (currentStep === "aadhaar") return STEPS[0];
    if (currentStep === "pan") return STEPS[1];
    if (currentStep === "face") return STEPS[2];
    return null;
  }, [currentStep]);

  const refresh = useCallback(async () => {
    const data = await refreshKyc();
    if (data.status === "verified") {
      router.replace("/business/businesses");
    }
    return data;
  }, [refreshKyc, router]);

  useEffect(() => {
    setLoading(shellLoading);
  }, [shellLoading]);

  async function onStartAadhaar() {
    setError("");
    setBusy(true);
    try {
      const redirectUrl = kycRedirectUrl();
      const res = await startAadhaarKyc(redirectUrl);
      if (!res.url) throw new Error("DigiLocker link was not returned.");
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Aadhaar verification");
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
      await verifyPanKyc(value);
      await refresh();
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
      await verifyFaceKyc(base64);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face verification failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Identity verification</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            <span className="text-gradient">Complete your KYC</span>
          </h1>
          <p className="mt-2 max-w-lg text-sm text-zinc-400">
            Three quick steps to verify who you are. Required before onboarding businesses.
          </p>
        </div>
        {!loading && currentStep !== "review" && currentStep !== "done" && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">{done} of 3 complete</p>
            <p className="text-lg font-semibold text-zinc-200">{progress}%</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!loading && currentStep !== "review" && currentStep !== "done" && (
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600/80 to-emerald-400/80 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Rejection banner */}
      {!loading && kyc?.status === "rejected" && (
        <div className="mt-6 flex gap-4 rounded-2xl border border-red-500/25 bg-red-500/8 p-5">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-red-100">Verification needs correction</p>
            <p className="mt-1 text-sm text-red-100/75">
              {kyc.rejectReason ?? kyc.reason ?? "Your submission was not approved."}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Fix the step below and resubmit — usually a new selfie or corrected PAN.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Left: stepper (desktop) */}
        {!loading && currentStep !== "review" && currentStep !== "done" && (
          <aside className="hidden lg:block">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-600">
              Your progress
            </p>
            <StepIndicator kyc={kyc} currentStep={currentStep} />
          </aside>
        )}

        {/* Main content */}
        <div className="min-w-0">
          {loading ? (
            <div className="glass rounded-2xl p-8">
              <LoadingSkeleton />
            </div>
          ) : currentStep === "review" ? (
            <div className="glass rounded-2xl p-8 sm:p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-3xl">
                ⏳
              </div>
              <h2 className="mt-6 text-xl font-semibold text-blue-100">Under admin review</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                All three steps are done. Our team is reviewing your documents — this usually
                takes a short while. You&apos;ll be able to add businesses once approved.
              </p>
              <div className="mx-auto mt-8 max-w-sm rounded-xl border border-white/5 bg-white/5 p-4 text-left text-sm">
                <p className="text-zinc-500">What happens next</p>
                <ul className="mt-3 space-y-2 text-zinc-400">
                  <li className="flex gap-2">
                    <span className="text-blue-300">1.</span> Admin reviews your KYC
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-300">2.</span> You get verified status
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-300">3.</span> My businesses unlocks
                  </li>
                </ul>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  setBusy(true);
                  try {
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not refresh status");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary mt-8 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {busy ? "Checking…" : "Check approval status"}
              </button>
              <Link
                href="/business"
                className="mt-4 block text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Back to dashboard
              </Link>
            </div>
          ) : activeMeta ? (
            <div className="glass overflow-hidden rounded-2xl">
              {/* Mobile step pills */}
              <div className="flex gap-2 border-b border-white/5 p-4 lg:hidden">
                {STEPS.map((step) => {
                  const visual = kycStepVisual(step.id, kyc, currentStep);
                  return (
                    <div
                      key={step.id}
                      className={`flex-1 rounded-lg py-2 text-center text-xs font-medium ${
                        visual === "done"
                          ? "bg-emerald-500/10 text-emerald-200"
                          : visual === "active"
                            ? "bg-white/10 text-zinc-100"
                            : "bg-white/5 text-zinc-600"
                      }`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>

              <div className="p-6 sm:p-8">
                {currentStep === "aadhaar" ? (
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                        Step {activeMeta.number} of 3
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-zinc-100">{activeMeta.title}</h2>
                      <p className="mt-1 text-sm text-zinc-400">{activeMeta.subtitle}</p>
                      <TipsList tips={activeMeta.tips} />
                    </div>
                    <div className="flex shrink-0 justify-center sm:justify-end sm:pt-1">
                      <KycAadhaarVisual active={busy} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                      Step {activeMeta.number} of 3
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-100">{activeMeta.title}</h2>
                    <p className="mt-1 text-sm text-zinc-400">{activeMeta.subtitle}</p>
                    <TipsList tips={activeMeta.tips} />
                  </div>
                )}

                {error && (
                  <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </p>
                )}

                <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-5 sm:p-6">
                  {currentStep === "aadhaar" && (
                    <div className="space-y-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onStartAadhaar}
                        className="btn-primary flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold disabled:opacity-60"
                      >
                        {busy ? (
                          <>
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Opening DigiLocker…
                          </>
                        ) : (
                          <>Open DigiLocker →</>
                        )}
                      </button>
                    </div>
                  )}

                  {currentStep === "pan" && (
                    <form onSubmit={onVerifyPan} className="space-y-5">
                      <label className="block">
                        <span className="text-sm text-zinc-400">PAN number</span>
                        <input
                          className={`${input} mt-2 font-mono text-lg uppercase tracking-[0.2em]`}
                          value={pan}
                          maxLength={10}
                          placeholder="ABCPV1234D"
                          autoComplete="off"
                          onChange={(e) => {
                            setError("");
                            setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                          }}
                        />
                        <p className="mt-2 text-xs text-zinc-600">
                          {pan.length}/10 characters · Format ABCDE1234F
                        </p>
                      </label>
                      <button
                        type="submit"
                        disabled={busy || pan.length !== 10}
                        className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold disabled:opacity-50"
                      >
                        {busy ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Verifying…
                          </span>
                        ) : (
                          "Verify PAN"
                        )}
                      </button>
                    </form>
                  )}

                  {currentStep === "face" && (
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-400">
                        Position your face in the frame. We&apos;ll match it against your Aadhaar
                        photo.
                      </p>
                      <FaceCapture disabled={busy} onCapture={onVerifyFace} />
                    </div>
                  )}
                </div>

                {done > 0 && (
                  <p className="mt-6 text-center text-xs text-zinc-600">
                    {3 - done} step{3 - done === 1 ? "" : "s"} remaining after this one
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {!loading && currentStep !== "review" && (
            <p className="mt-6 text-center text-xs text-zinc-600">
              <Link href="/business" className="transition hover:text-zinc-400">
                ← Back to dashboard
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
