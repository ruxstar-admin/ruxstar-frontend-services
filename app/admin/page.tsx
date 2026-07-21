"use client";

import Link from "next/link";
import { useAdminShell } from "@/components/admin-shell";
import { useAdminMetrics, useAdminRevenue, useAdminVendorKyc } from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const SOURCE_LABELS: Record<string, string> = {
  booking: "Bookings",
  event: "Events",
  print: "Print orders",
};

export default function AdminOverviewPage() {
  const { user } = useAdminShell();
  const { data: metrics, isLoading } = useAdminMetrics();
  const { data: revenue } = useAdminRevenue(30);
  const { data: kyc = [] } = useAdminVendorKyc();

  const pendingKyc = kyc.filter((r) => r.status === "pending_review");
  const maxSeries = Math.max(1, ...(revenue?.series ?? []).map((d) => d.amount));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Command center</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
        <span className="text-gradient">Welcome, {user?.name || "Admin"}</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Everything happening across Ruxstar — revenue, people, and operations at a glance.
      </p>

      {/* Headline metrics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={metrics ? money(metrics.revenue.amount) : "—"}
          hint={metrics ? `${metrics.revenue.count} payments` : ""}
          accent="emerald"
          loading={isLoading}
        />
        <StatCard
          label="Users"
          value={metrics ? String(metrics.users.total) : "—"}
          hint={metrics ? `${metrics.users.vendors} vendors · ${metrics.users.customers} customers` : ""}
          loading={isLoading}
        />
        <StatCard
          label="Businesses"
          value={metrics ? String(metrics.businesses.total) : "—"}
          hint={metrics ? `${metrics.businesses.live} live · ${metrics.businesses.suspended} suspended` : ""}
          loading={isLoading}
        />
        <StatCard
          label="Bookings"
          value={metrics ? String(metrics.bookings.confirmed) : "—"}
          hint={metrics ? `${metrics.printOrders.total} print · ${metrics.events.total} events` : ""}
          loading={isLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Revenue trend */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Revenue · last 30 days</p>
            <Link href="/admin/payments" className="text-xs text-zinc-400 hover:text-zinc-200">
              Ledger →
            </Link>
          </div>
          {!revenue || revenue.series.length === 0 ? (
            <div className="mt-6 flex h-40 items-center justify-center text-sm text-zinc-600">
              No revenue in this window yet.
            </div>
          ) : (
            <div className="mt-6 flex h-40 items-end gap-1">
              {revenue.series.map((d) => (
                <div key={d.date} className="group flex flex-1 flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t bg-emerald-400/30 transition group-hover:bg-emerald-400/60"
                    style={{ height: `${Math.max(2, (d.amount / maxSeries) * 100)}%` }}
                    title={`${d.date}: ${money(d.amount)}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by source */}
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Revenue by source</p>
          <ul className="mt-4 space-y-3">
            {(metrics?.revenueBySource ?? []).length === 0 ? (
              <li className="text-sm text-zinc-600">No payments yet.</li>
            ) : (
              metrics?.revenueBySource.map((s) => {
                const pct = metrics.revenue.amount
                  ? Math.round((s.amount / metrics.revenue.amount) * 100)
                  : 0;
                return (
                  <li key={s.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{SOURCE_LABELS[s.source] ?? s.source}</span>
                      <span className="font-medium text-zinc-100">{money(s.amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-emerald-400/50" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Top vendors */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Top vendors by revenue</p>
            <Link href="/admin/users?role=vendor" className="text-xs text-zinc-400 hover:text-zinc-200">
              All vendors →
            </Link>
          </div>
          {!revenue || revenue.byVendor.length === 0 ? (
            <div className="mt-6 flex h-24 items-center justify-center text-sm text-zinc-600">
              No vendor revenue yet.
            </div>
          ) : (
            <ol className="mt-4 space-y-2">
              {revenue.byVendor.slice(0, 6).map((v, i) => (
                <li
                  key={v.vendorId ?? i}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <span className="w-5 text-center text-xs text-zinc-500">{i + 1}</span>
                  <Link
                    href={v.vendorId ? `/admin/users/${v.vendorId}` : "#"}
                    className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-white"
                  >
                    {v.vendorName}
                  </Link>
                  <span className="shrink-0 text-sm font-medium text-emerald-300">{money(v.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Pending KYC queue */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">KYC awaiting review</p>
            <Link href="/admin/kyc" className="text-xs text-zinc-400 hover:text-zinc-200">
              Review all →
            </Link>
          </div>
          {pendingKyc.length === 0 ? (
            <div className="mt-6 flex h-24 items-center justify-center text-sm text-zinc-600">
              All caught up. 🎉
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingKyc.slice(0, 5).map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {row.name ?? row.businessName ?? "Vendor"}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {row.mobile ? `+91 ${row.mobile}` : "No mobile"}
                    </p>
                  </div>
                  <Link
                    href="/admin/kyc"
                    className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "emerald";
  loading?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-white/5" />
      ) : (
        <p className={`mt-2 text-3xl font-semibold ${accent === "emerald" ? "text-emerald-300" : "text-zinc-100"}`}>
          {value}
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
