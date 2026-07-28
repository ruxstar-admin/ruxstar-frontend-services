"use client";

import Link from "next/link";
import { useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { setPrintAcceptingOrders, type Business } from "@/lib/api";
import { useVendorBusinesses } from "@/lib/swr-hooks";

export default function VendorStorePage() {
  const { kycVerified, kyc } = useVendorShell();
  const { data: businesses = [], isLoading, mutate } = useVendorBusinesses(kycVerified);
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const printBusinesses = businesses.filter((b) => b.module === "print");
  // Availability only means something once the shop can actually take orders.
  const shops = printBusinesses.filter((b) => b.setupComplete);
  const pendingSetupCount = printBusinesses.length - shops.length;

  const isAccepting = (shop: Business) =>
    override[shop.id] ?? (shop.setup?.printProfile?.acceptingOrders ?? true);

  async function toggle(shop: Business) {
    const next = !isAccepting(shop);
    setOverride((o) => ({ ...o, [shop.id]: next }));
    setBusyId(shop.id);
    try {
      await setPrintAcceptingOrders(shop.id, next);
      await mutate();
    } catch {
      setOverride((o) => ({ ...o, [shop.id]: !next }));
    } finally {
      setBusyId(null);
    }
  }

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Verify your identity to manage your store.
            {kyc?.status === "pending_review" && " Your card is under review."}
          </p>
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Get your Ruxstar Card
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Availability</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          <span className="text-gradient">Store</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Open or close each shop for new orders. Closed shops stay visible to customers but can&apos;t
          take new orders.
        </p>
        {pendingSetupCount > 0 && (
          <p className="mt-2 text-xs text-amber-200/80">
            {pendingSetupCount} print {pendingSetupCount === 1 ? "shop is" : "shops are"} still in
            setup and won&apos;t appear here until finished.{" "}
            <Link href="/business/businesses" className="underline hover:text-amber-100">
              Finish setup
            </Link>
          </p>
        )}
      </div>

      <div className="scroll-pane mt-6 min-h-0 flex-1">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14 text-center">
            <p className="text-3xl">🏬</p>
            <p className="mt-3 max-w-sm text-sm text-zinc-400">
              {pendingSetupCount > 0
                ? "No shops are ready yet. Finish print setup to manage availability here."
                : "No shops yet. Set up a live business to manage its availability here."}
            </p>
            <Link
              href="/business/businesses"
              className="btn-primary mt-5 rounded-full px-5 py-2 text-sm font-semibold"
            >
              Manage businesses
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shops.map((shop) => {
              const accepting = isAccepting(shop);
              const busy = busyId === shop.id;
              return (
                <article
                  key={shop.id}
                  className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg">
                      🖨️
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-100">{shop.name}</p>
                      {shop.address && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{shop.address}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
                        accepting
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : "border-zinc-500/30 bg-white/[0.03] text-zinc-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${accepting ? "bg-emerald-400" : "bg-zinc-500"}`}
                      />
                      {accepting ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                    <span className="text-xs text-zinc-500">
                      {accepting ? "Accepting new orders" : "Not accepting orders"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={accepting}
                      disabled={busy}
                      onClick={() => void toggle(shop)}
                      title={accepting ? "Tap to close" : "Tap to open"}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                        accepting ? "bg-emerald-500/80" : "bg-white/15"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          accepting ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
