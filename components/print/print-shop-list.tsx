"use client";

import type { PrintShop } from "@/lib/api";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function PrintShopList({
  shops,
  loading,
  onPick,
}: {
  shops: PrintShop[];
  loading: boolean;
  onPick: (shop: PrintShop) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
        <div>
          <p className="text-4xl">🏬</p>
          <p className="mt-3 text-sm text-zinc-400">
            No print shops are available for this product in that area yet.
          </p>
          <p className="mt-1 text-xs text-zinc-600">Try another city or check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {shops.map((shop) => {
        const closed = !shop.acceptingOrders;
        const perLabel = shop.pricingModel === "per_page" ? "/page" : "/unit";
        return (
          <button
            key={shop.businessId}
            type="button"
            disabled={closed}
            onClick={() => onPick(shop)}
            className={`group flex flex-col rounded-2xl border p-4 text-left transition ${
              closed
                ? "cursor-not-allowed border-white/8 bg-white/[0.01] opacity-70"
                : "border-white/8 bg-white/[0.02] hover:border-emerald-400/30 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] text-lg">
                {shop.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "🖨️"
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-zinc-100">{shop.name}</p>
                  {closed && (
                    <span className="shrink-0 rounded-full border border-zinc-500/30 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      Closed
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {shop.city ? `${shop.city} · ` : ""}
                  {shop.turnaroundDays > 0 ? `~${shop.turnaroundDays} day turnaround` : "Fast turnaround"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between border-t border-white/5 pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Starting from</p>
                <p className="text-lg font-semibold text-emerald-300">
                  {money(shop.fromPrice)}
                  <span className="text-xs font-normal text-zinc-500">{perLabel}</span>
                </p>
              </div>
              <span
                className={`text-xs font-medium ${
                  closed ? "text-zinc-600" : "text-zinc-400 group-hover:text-emerald-300"
                }`}
              >
                {closed ? "Currently closed" : "Configure →"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
