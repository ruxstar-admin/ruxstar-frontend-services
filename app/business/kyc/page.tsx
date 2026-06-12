"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FaceCapture } from "@/components/face-capture";
import { KycAadhaarVisual } from "@/components/kyc-aadhaar-visual";
import { KycPanVisual } from "@/components/kyc-pan-visual";
import { KycReviewPanel } from "@/components/kyc-review-panel";
import { KycVerifiedPanel } from "@/components/kyc-verified-panel";
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

const IDENTITY_STEPS = [
  {
    id: "aadhaar" as const,
    number: 1,
    label: "Aadhaar",
    title: "Verify your Aadhaar",
    subtitle: "Step 1 toward your Ruxstar Card",
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
    subtitle: "Step 2 toward your Ruxstar Card",
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
    subtitle: "Step 3 toward your Ruxstar Card",
    tips: [
      "Face the camera with good lighting",
      "We match your live selfie to your Aadhaar photo",
    ],
  },
];

const ADMIN_REVIEW_STEP = {
  number: 4,
  label: "Admin review",
  title: "Card review",
  subtitle: "Admin approves and issues your Ruxstar Card",
};

const TOTAL_CARD_STEPS = 4;

function completedCount(kyc: VendorKycStatus | null) {
  let n = 0;
  if (kyc?.aadhaar?.verified || kyc?.aadhaar?.status === "verified") n++;
  if (kyc?.pan?.verified || kyc?.pan?.status === "verified") n++;
  if (kyc?.face?.verified || kyc?.face?.status === "verified") n++;
  return n;
}

function cardProgress(
  kyc: VendorKycStatus | null,
  currentStep: ReturnType<typeof nextKycStep>,
) {
  const identityDone = completedCount(kyc);
  if (currentStep === "done") return 100;
  if (currentStep === "review") return 75;
  return Math.round((identityDone / TOTAL_CARD_STEPS) * 100);
}

function completedCardSteps(
  kyc: VendorKycStatus | null,
  currentStep: ReturnType<typeof nextKycStep>,
) {
  const identityDone = completedCount(kyc);
  if (currentStep === "done") return TOTAL_CARD_STEPS;
  if (currentStep === "review") return 3;
  return identityDone;
}

function StepIndicator({
  kyc,
  currentStep,
}: {
  kyc: VendorKycStatus | null;
  currentStep: ReturnType<typeof nextKycStep>;
}) {
  const inReview = currentStep === "review";
  const isVerified = currentStep === "done";

  const reviewVisual = isVerified ? "done" : inReview ? "active" : "upcoming";

  return (
    <ol className="space-y-0">
      {IDENTITY_STEPS.map((step) => {
        const visual = isVerified
          ? "done"
          : inReview
            ? "done"
            : kycStepVisual(step.id, kyc, currentStep);

        return (
          <li key={step.id} className="relative flex gap-4">
            <span
              className={`absolute left-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-px ${
                visual === "done" ? "bg-emerald-500/40" : "bg-white/10"
              }`}
            />
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
            <div className="pb-8">
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
                {visual === "done" ? "Verified" : visual === "active" ? "In progress" : "Pending"}
              </p>
            </div>
          </li>
        );
      })}

      <li className="relative flex gap-4">
        <div
          className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
            reviewVisual === "done"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
              : reviewVisual === "active"
                ? "border-blue-400/40 bg-blue-500/15"
                : "border-white/10 bg-white/5 text-zinc-500"
          }`}
        >
          {reviewVisual === "done" ? (
            "✓"
          ) : reviewVisual === "active" ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          ) : (
            ADMIN_REVIEW_STEP.number
          )}
        </div>
        <div>
          <p
            className={`text-sm font-medium ${
              reviewVisual === "active"
                ? "text-blue-200"
                : reviewVisual === "done"
                  ? "text-emerald-200"
                  : "text-zinc-500"
            }`}
          >
            {ADMIN_REVIEW_STEP.label}
          </p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {reviewVisual === "done"
              ? "Card issued"
              : reviewVisual === "active"
                ? "Generating card"
                : "Pending"}
          </p>
        </div>
      </li>
    </ol>
  );
}

function TipsList({ tips }: { tips: string[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {tips.map((tip) => (
        <li key={tip} className="flex gap-2 text-xs text-zinc-400">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/25" />
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

function MobileStepPills({
  kyc,
  currentStep,
}: {
  kyc: VendorKycStatus | null;
  currentStep: ReturnType<typeof nextKycStep>;
}) {
  const inReview = currentStep === "review";
  const isVerified = currentStep === "done";
  const reviewVisual = isVerified ? "done" : inReview ? "active" : "upcoming";

  return (
    <div className="mb-0 flex gap-1.5 lg:hidden">
      {IDENTITY_STEPS.map((step) => {
        const visual = isVerified
          ? "done"
          : inReview
            ? "done"
            : kycStepVisual(step.id, kyc, currentStep);
        return (
          <div
            key={step.id}
            className={`flex-1 rounded-lg py-2 text-center text-[10px] font-medium sm:text-xs ${
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
      <div
        className={`flex-1 rounded-lg py-2 text-center text-[10px] font-medium sm:text-xs ${
          reviewVisual === "done"
            ? "bg-emerald-500/10 text-emerald-200"
            : reviewVisual === "active"
              ? "bg-blue-500/10 text-blue-200"
              : "bg-white/5 text-zinc-600"
        }`}
      >
        Review
      </div>
    </div>
  );
}

export default function VendorKycPage() {
  const { user, kyc, kycVerified, refreshKyc, loading: shellLoading } = useVendorShell();
  const [loading, setLoading] = useState(shellLoading);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pan, setPan] = useState("");

  const currentStep = nextKycStep(kyc);
  const done = completedCount(kyc);
  const progress = cardProgress(kyc, currentStep);
  const stepsComplete = completedCardSteps(kyc, currentStep);
  const isVerified = kycVerified || currentStep === "done";
  const inReview = !isVerified && currentStep === "review";

  const activeMeta = useMemo(() => {
    if (currentStep === "aadhaar") return IDENTITY_STEPS[0];
    if (currentStep === "pan") return IDENTITY_STEPS[1];
    if (currentStep === "face") return IDENTITY_STEPS[2];
    return null;
  }, [currentStep]);

  const refresh = useCallback(async () => {
    return refreshKyc();
  }, [refreshKyc]);

  useEffect(() => {
    setLoading(shellLoading);
  }, [shellLoading]);

  useEffect(() => {
    if (currentStep === "face") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentStep]);

  // While the card is awaiting admin approval, quietly poll so it flips to the
  // Ruxstar Card automatically the moment it's approved.
  useEffect(() => {
    if (!inReview) return;
    const id = setInterval(() => {
      refreshKyc().catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [inReview, refreshKyc]);

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
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Ruxstar Card</p>
          <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
            <span className="text-gradient">
              {isVerified
                ? "Your Ruxstar Card"
                : inReview
                  ? "Generating your card"
                  : "Get your Ruxstar Card"}
            </span>
          </h1>
          <p className="mt-1 max-w-lg text-sm text-zinc-400">
            {isVerified
              ? "Your verified card is active. You're approved to onboard businesses."
              : inReview
                ? "Step 4 — admin is reviewing your details to issue your Ruxstar Card."
                : "Four steps to generate your card: identity checks, then admin review."}
          </p>
        </div>
        {!loading && !isVerified && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">
              {stepsComplete} of {TOTAL_CARD_STEPS} complete
            </p>
            <p className="text-lg font-semibold text-zinc-200">{progress}%</p>
          </div>
        )}
        {!loading && isVerified && (
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Verified
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!loading && !isVerified && (
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              inReview
                ? "bg-gradient-to-r from-blue-600/80 to-blue-400/80"
                : "bg-gradient-to-r from-emerald-600/80 to-emerald-400/80"
            }`}
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

      <div className={isVerified ? "mt-6" : "mt-6 grid gap-6 lg:grid-cols-[220px_1fr]"}>
        {!loading && !isVerified && (
          <aside className="hidden lg:block">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-600">
              Your progress
            </p>
            <StepIndicator kyc={kyc} currentStep={currentStep} />
          </aside>
        )}

        <div className="min-w-0">
          {loading ? (
            <div className="glass rounded-2xl p-8">
              <LoadingSkeleton />
            </div>
          ) : isVerified ? (
            <KycVerifiedPanel user={user} kyc={kyc} />
          ) : inReview ? (
            <>
              <div className="mb-4 lg:hidden">
                <MobileStepPills kyc={kyc} currentStep={currentStep} />
              </div>
              <KycReviewPanel
              busy={busy}
              error={error}
              onRefresh={async () => {
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
            />
            </>
          ) : activeMeta ? (
            <div className="glass overflow-hidden rounded-2xl">
              <div className="border-b border-white/5 px-4 pt-4 lg:hidden">
                <MobileStepPills kyc={kyc} currentStep={currentStep} />
              </div>

              <div className="p-4 sm:p-5">
                {activeMeta && (
                  <div
                    className={`flex flex-col gap-4 lg:grid lg:items-start lg:gap-6 ${
                      currentStep === "face"
                        ? "lg:grid-cols-[minmax(0,1fr)_15rem]"
                        : currentStep === "pan"
                          ? "lg:grid-cols-[minmax(0,1fr)_12.5rem]"
                          : "lg:grid-cols-[minmax(0,1fr)_13.5rem]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                        Step {activeMeta.number} of {TOTAL_CARD_STEPS}
                      </p>
                      <h2 className="mt-0.5 text-lg font-semibold text-zinc-100">{activeMeta.title}</h2>
                      <p className="mt-0.5 text-sm text-zinc-400">{activeMeta.subtitle}</p>
                      <TipsList tips={activeMeta.tips} />

                      {currentStep === "aadhaar" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={onStartAadhaar}
                          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
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
                      )}

                      {currentStep === "pan" && (
                        <form onSubmit={onVerifyPan} className="mt-4 space-y-3">
                          <label className="block">
                            <span className="text-sm text-zinc-400">PAN number</span>
                            <input
                              className={`${input} mt-1.5 font-mono text-base uppercase tracking-[0.2em]`}
                              value={pan}
                              maxLength={10}
                              placeholder="ABCPV1234D"
                              autoComplete="off"
                              onChange={(e) => {
                                setError("");
                                setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                              }}
                            />
                            <p className="mt-1 text-xs text-zinc-600">
                              {pan.length}/10 · ABCDE1234F
                            </p>
                          </label>
                          <button
                            type="submit"
                            disabled={busy || pan.length !== 10}
                            className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-50"
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
                    </div>

                    <div
                      className={`flex w-full shrink-0 justify-center ${
                        currentStep === "face"
                          ? "lg:w-[15rem] lg:justify-center"
                          : currentStep === "pan"
                            ? "lg:-ml-3 lg:w-[12.5rem] lg:justify-start"
                            : "lg:w-[13.5rem] lg:justify-center"
                      }`}
                    >
                      {currentStep === "aadhaar" && <KycAadhaarVisual active={busy} />}
                      {currentStep === "pan" && (
                        <KycPanVisual active={busy} panPreview={pan.length === 10 ? pan : undefined} />
                      )}
                      {currentStep === "face" && (
                        <FaceCapture compact disabled={busy} onCapture={onVerifyFace} />
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
                    {error}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {!loading && !isVerified && (
            <p className="mt-4 text-center text-xs text-zinc-600">
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
