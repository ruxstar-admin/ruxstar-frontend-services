"use client";

import Link from "next/link";

type Props = {
  busy: boolean;
  error: string;
  onRefresh: () => Promise<void>;
};

const CHECKS = [
  { id: "aadhaar", label: "Aadhaar", detail: "DigiLocker verified" },
  { id: "pan", label: "PAN", detail: "ITD verified" },
  { id: "face", label: "Selfie", detail: "Face matched" },
] as const;

export function KycReviewPanel({ busy, error, onRefresh }: Props) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="border-b border-white/5 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Step 4 of 4 · Card generation
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-100">Generating your Ruxstar Card</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Identity checks are complete. An admin will review and issue your card.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-white/5 bg-white/5">
        {CHECKS.map((item) => (
          <div key={item.id} className="bg-[#0a0a0b]/80 px-3 py-4 text-center sm:px-4">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
              ✓
            </div>
            <p className="mt-2 text-xs font-medium text-zinc-200">{item.label}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center gap-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-blue-400/40 kyc-review-ring" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-100">Admin review in progress</p>
            <p className="text-xs text-zinc-500">
              Your Ruxstar Card will appear here automatically once approved.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onRefresh}
            className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Checking…" : "Check card status"}
          </button>
          <Link
            href="/business"
            className="rounded-full border border-white/10 px-6 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
