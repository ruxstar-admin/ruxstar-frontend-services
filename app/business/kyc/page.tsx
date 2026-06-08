"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Particles } from "@/components/particles";
import {
  getToken,
  getUserRole,
  getVendorKycStatus,
  nextKycStep,
  startAadhaarKyc,
  syncAadhaarKyc,
  type VendorKycStatus,
  verifyFaceKyc,
  verifyPanKyc,
} from "@/lib/api";

const input = "field-input";

const steps = [
  { id: "aadhaar", label: "Aadhaar", hint: "Verify via DigiLocker" },
  { id: "pan", label: "PAN", hint: "Enter your PAN number" },
  { id: "face", label: "Selfie", hint: "Match your Aadhaar photo" },
] as const;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read image."));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export default function VendorKycPage() {
  const router = useRouter();
  const [kyc, setKyc] = useState<VendorKycStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pan, setPan] = useState("");
  const [selfieName, setSelfieName] = useState("");

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
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const user = localStorage.getItem("ruxstar_user");
    if (user) {
      try {
        const parsed = JSON.parse(user);
        if (getUserRole(parsed) !== "vendor") {
          router.replace("/customer");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }
    }

    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KYC status"))
      .finally(() => setLoading(false));
  }, [refresh, router]);

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

  async function onSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Upload a JPEG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }

    setBusy(true);
    setSelfieName(file.name);
    try {
      const base64 = await fileToBase64(file);
      const data = await verifyFaceKyc(base64);
      setKyc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face verification failed");
      setSelfieName("");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function stepIndex(id: (typeof steps)[number]["id"]) {
    return steps.findIndex((s) => s.id === id);
  }

  const activeIndex =
    currentStep === "aadhaar" || currentStep === "pan" || currentStep === "face"
      ? stepIndex(currentStep)
      : steps.length;

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
          ) : currentStep === "rejected" ? (
            <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-6">
              <p className="text-lg font-medium text-red-100">KYC rejected</p>
              <p className="mt-2 text-sm text-red-100/80">
                {kyc?.rejectReason ?? kyc?.reason ?? "Please contact support or retry verification."}
              </p>
            </div>
          ) : (
            <>
              <ol className="mt-8 flex gap-2">
                {steps.map((step, i) => {
                  const done = i < activeIndex;
                  const active = i === activeIndex;
                  return (
                    <li key={step.id} className="flex-1">
                      <div
                        className={`rounded-lg border px-3 py-3 text-center text-xs transition ${
                          done
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            : active
                              ? "border-white/20 bg-white/10 text-zinc-100"
                              : "border-white/5 bg-white/5 text-zinc-500"
                        }`}
                      >
                        <span className="block font-medium">{step.label}</span>
                        <span className="mt-0.5 block opacity-70">{done ? "Done" : step.hint}</span>
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
                      You&apos;ll be redirected to DigiLocker to verify your Aadhaar with OTP and consent.
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
                      I finished on DigiLocker — sync now
                    </button>
                  </div>
                )}

                {currentStep === "pan" && (
                  <form onSubmit={onVerifyPan} className="space-y-4">
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
                      {busy ? "Verifying…" : "Verify PAN"}
                    </button>
                  </form>
                )}

                {currentStep === "face" && (
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400">
                      Upload a clear selfie. We&apos;ll match it against your Aadhaar photo.
                    </p>
                    <label className="block">
                      <span className="sr-only">Selfie</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        onChange={onSelfieChange}
                        className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-200 hover:file:bg-white/15"
                      />
                    </label>
                    {selfieName && (
                      <p className="text-xs text-zinc-500">Uploaded: {selfieName}</p>
                    )}
                    {busy && (
                      <p className="text-sm text-zinc-500">Verifying your selfie…</p>
                    )}
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
