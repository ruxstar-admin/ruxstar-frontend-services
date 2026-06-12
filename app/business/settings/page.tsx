"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { becomeCustomer } from "@/lib/api";

export default function VendorSettingsPage() {
  const router = useRouter();
  const { user } = useVendorShell();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  async function onSwitchToCustomer() {
    setSwitching(true);
    setError("");
    try {
      await becomeCustomer();
      router.replace("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch account");
      setSwitching(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Account</p>
      <h1 className="mt-1 text-2xl font-semibold">Settings</h1>

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      )}

      <section className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-lg font-medium">Profile</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd className="text-zinc-100">{user?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Mobile</dt>
            <dd className="text-zinc-100">{user?.mobile ? `+91 ${user.mobile}` : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-5">
        <div>
          <p className="text-sm font-medium text-zinc-200">Switch to customer account</p>
          <p className="text-xs text-zinc-500">
            Your KYC and businesses stay saved — switch back anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchToCustomer}
          disabled={switching}
          className="rounded-full border border-white/10 px-5 py-2 text-sm transition hover:bg-white/5 disabled:opacity-60"
        >
          {switching ? "Switching…" : "Switch"}
        </button>
      </section>
    </div>
  );
}
