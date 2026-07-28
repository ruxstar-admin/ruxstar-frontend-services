"use client";

import { useMemo } from "react";
import { useAdminShell } from "@/components/admin-shell";
import { HBar, Panel } from "@/components/admin-ui";
import { useAdminMetrics } from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

export default function AdminOverviewPage() {
  const { user } = useAdminShell();
  const { data: metrics, isLoading } = useAdminMetrics();

  const platformBars = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: "Customers", value: metrics.users.customers, color: "sky" as const },
      { label: "Vendors", value: metrics.users.vendors, color: "emerald" as const },
      { label: "Staff (admin + employee)", value: metrics.users.admins + metrics.users.employees, color: "violet" as const },
      { label: "Disabled accounts", value: metrics.users.disabled, color: "amber" as const },
      { label: "Live businesses", value: metrics.businesses.live, color: "emerald" as const },
      { label: "Draft businesses", value: metrics.businesses.draft, color: "zinc" as const },
      { label: "Suspended businesses", value: metrics.businesses.suspended, color: "amber" as const },
      { label: "Confirmed bookings", value: metrics.bookings.confirmed, color: "sky" as const },
      { label: "Print orders", value: metrics.printOrders.total, color: "violet" as const },
      { label: "Events", value: metrics.events.total, color: "zinc" as const },
    ].filter((r) => r.value > 0);
  }, [metrics]);

  const platformMax = Math.max(1, ...platformBars.map((b) => b.value));

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <p className="text-xs text-zinc-500">Overview</p>
        <h1 className="mt-0.5 text-xl text-zinc-200">Hi, {user?.name || "Admin"}</h1>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
        <NumTile label="Revenue" value={isLoading ? "…" : money(metrics?.revenue.amount ?? 0)} sub={`${metrics?.revenue.count ?? 0} payments`} tint="emerald" />
        <NumTile label="Users" value={isLoading ? "…" : String(metrics?.users.total ?? 0)} sub={`${metrics?.users.vendors ?? 0} vendors`} />
        <NumTile label="Businesses" value={isLoading ? "…" : String(metrics?.businesses.total ?? 0)} sub={`${metrics?.businesses.live ?? 0} live`} />
        <NumTile label="Bookings" value={isLoading ? "…" : String(metrics?.bookings.confirmed ?? 0)} sub={`${metrics?.printOrders.total ?? 0} print orders`} />
      </div>

      <div className="mt-4">
        <Panel title="Platform activity">
          {isLoading ? (
            <div className="space-y-3 py-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-white/5" />
              ))}
            </div>
          ) : platformBars.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-500">No users or businesses yet.</p>
          ) : (
            <div className="space-y-3">
              {platformBars.map((b) => (
                <HBar key={b.label} label={b.label} value={b.value} max={platformMax} color={b.color} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function NumTile({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  tint?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3 sm:px-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg tabular-nums sm:text-xl ${tint === "emerald" ? "text-emerald-300/90" : "text-zinc-200"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
    </div>
  );
}
