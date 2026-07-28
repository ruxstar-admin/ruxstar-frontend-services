"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { useVendorBookings, useVendorBusinesses } from "@/lib/swr-hooks";
import { computeVendorMetrics, formatINR, type DayBucket } from "@/lib/vendor-metrics";
import type { Business } from "@/lib/api";

export default function VendorDashboardPage() {
  const { user, kyc, kycVerified, loading } = useVendorShell();
  const { data: bookings, isLoading: bookingsLoading } = useVendorBookings(kycVerified);
  const { data: businesses = [], isLoading: businessesLoading } = useVendorBusinesses(kycVerified);

  const kycStatus = kyc?.status ?? "pending";

  const metrics = useMemo(() => computeVendorMetrics(bookings ?? []), [bookings]);

  // Anything the vendor still has to do before a business is publicly bookable.
  const notLive = useMemo(
    () => businesses.filter((b) => !(b.setupComplete && b.status === "live")),
    [businesses],
  );

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading dashboard…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          <span className="text-gradient">Welcome, {user?.name || "Vendor"}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {kycVerified
            ? "Here's how your businesses are performing."
            : "Get your Ruxstar Card first, then onboard your businesses."}
        </p>
      </div>

      {kycVerified ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total revenue"
              value={formatINR(metrics.totalRevenue)}
              hint={`${metrics.paidCount} paid booking${metrics.paidCount === 1 ? "" : "s"}`}
              accent
              loading={bookingsLoading}
            />
            <MetricCard
              label="This month"
              value={formatINR(metrics.monthRevenue)}
              hint="Revenue in current month"
              loading={bookingsLoading}
            />
            <MetricCard
              label="Upcoming"
              value={String(metrics.upcomingCount)}
              hint={`${formatINR(metrics.upcomingRevenue)} expected`}
              loading={bookingsLoading}
            />
            <MetricCard
              label="Avg booking"
              value={formatINR(metrics.avgBooking)}
              hint="Per paid booking"
              loading={bookingsLoading}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RevenueArea days={metrics.last7} peak={metrics.peakDayRevenue} loading={bookingsLoading} />
            <BookingDonut
              completed={Math.max(metrics.paidCount - metrics.upcomingCount, 0)}
              upcoming={metrics.upcomingCount}
              cancelled={metrics.cancelledCount}
              loading={bookingsLoading}
            />
          </div>

          <GoLiveChecklist businesses={notLive} total={businesses.length} loading={businessesLoading} />
        </>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Ruxstar Card</p>
              <p className="mt-2 text-lg font-semibold capitalize">
                {kycStatus.replace(/_/g, " ")}
              </p>
              <Link
                href="/business/kyc"
                className="mt-2 inline-block text-xs text-amber-200 hover:underline"
              >
                Get your card →
              </Link>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
              <p className="mt-2 text-3xl font-semibold">{businesses.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Unlocks with your card</p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="text-lg font-medium text-amber-100">
              Get your Ruxstar Card to start onboarding
            </h2>
            <p className="mt-2 max-w-xl text-sm text-amber-200/80">
              Verify your identity (Aadhaar, PAN and selfie), then admin review issues your
              Ruxstar Card before you can add businesses. Use the sidebar to open{" "}
              <strong className="font-medium">Ruxstar Card</strong>.
            </p>
            {kyc?.rejectReason && (
              <p className="mt-3 text-sm text-red-200/90">Rejection reason: {kyc.rejectReason}</p>
            )}
            <Link
              href="/business/kyc"
              className="btn-primary mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              {kycStatus === "rejected"
                ? "Fix verification"
                : kycStatus === "in_progress"
                  ? "Continue verification"
                  : kycStatus === "pending_review"
                    ? "View card status"
                    : "Get your Ruxstar Card"}
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function GoLiveChecklist({
  businesses,
  total,
  loading,
}: {
  businesses: Business[];
  total: number;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="mt-4 h-28 animate-pulse rounded-2xl bg-white/5" />;
  }
  if (total === 0) {
    return (
      <div className="glass mt-4 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Go live</p>
        <p className="mt-2 text-sm text-zinc-400">
          You haven&apos;t added a business yet.{" "}
          <Link href="/business/businesses" className="text-amber-200 hover:underline">
            Add your first one →
          </Link>
        </p>
      </div>
    );
  }
  if (businesses.length === 0) {
    return (
      <div className="glass mt-4 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Go live</p>
        <p className="mt-2 text-sm text-emerald-300">
          All {total} business{total === 1 ? " is" : "es are"} live and bookable.
        </p>
      </div>
    );
  }

  return (
    <div className="glass mt-4 rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">What&apos;s left to go live</p>
        <p className="text-xs text-zinc-500">
          {total - businesses.length} of {total} live
        </p>
      </div>

      <ul className="mt-4 space-y-4">
        {businesses.map((biz) => {
          const issues = biz.readiness?.issues ?? [];
          return (
            <li key={biz.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-zinc-100">{biz.name}</p>
                <Link
                  href={`/business/businesses/${biz.id}/setup`}
                  className="text-xs font-medium text-amber-200 hover:underline"
                >
                  {biz.setupComplete ? "Review setup" : "Finish setup"} →
                </Link>
              </div>
              {issues.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {issues.slice(0, 4).map((issue, i) => (
                    <li key={`${issue.field}-${i}`} className="flex gap-2 text-xs text-zinc-400">
                      <span className="text-amber-300">•</span>
                      {issue.message}
                    </li>
                  ))}
                  {issues.length > 4 && (
                    <li className="text-xs text-zinc-500">
                      +{issues.length - 4} more to fix
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-zinc-400">
                  {biz.setupComplete
                    ? "Setup is done — publish it to make it bookable."
                    : "Complete the setup steps to go live."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-white/5" />
      ) : (
        <p className={`mt-2 text-2xl font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>
          {value}
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function RevenueArea({
  days,
  peak,
  loading,
}: {
  days: DayBucket[];
  peak: number;
  loading?: boolean;
}) {
  // Map day buckets to an SVG path inside a 100x40 viewBox (responsive via preserveAspectRatio).
  const W = 100;
  const H = 40;
  const max = peak || 1;
  const pts = days.map((d, i) => {
    const x = days.length > 1 ? (i / (days.length - 1)) * W : W / 2;
    const y = H - (d.revenue / max) * (H - 4) - 2;
    return { x, y, d };
  });

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Revenue · last 7 days</p>
        <p className="text-xs text-zinc-500">{formatINR(days.reduce((s, d) => s + d.revenue, 0))}</p>
      </div>

      {loading ? (
        <div className="mt-6 h-36 animate-pulse rounded-xl bg-white/5" />
      ) : peak === 0 ? (
        <div className="mt-6 flex h-36 items-center justify-center text-sm text-zinc-600">
          No revenue in the last 7 days yet.
        </div>
      ) : (
        <div className="mt-6">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-32 w-full overflow-visible"
            role="img"
            aria-label="Revenue trend for the last 7 days"
          >
            <defs>
              <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#rev-fill)" />
            <path
              d={line}
              fill="none"
              stroke="rgb(52 211 153)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {pts.map((p) => (
              <circle
                key={p.d.key}
                cx={p.x}
                cy={p.y}
                r={1.6}
                fill="rgb(52 211 153)"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${p.d.label}: ${formatINR(p.d.revenue)} · ${p.d.count} booking${p.d.count === 1 ? "" : "s"}`}</title>
              </circle>
            ))}
          </svg>
          <div className="mt-2 flex justify-between">
            {days.map((d) => (
              <span key={d.key} className="text-[10px] text-zinc-500">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingDonut({
  completed,
  upcoming,
  cancelled,
  loading,
}: {
  completed: number;
  upcoming: number;
  cancelled: number;
  loading?: boolean;
}) {
  const total = completed + upcoming + cancelled;
  const segments = [
    { label: "Completed", value: completed, color: "rgb(52 211 153)" },
    { label: "Upcoming", value: upcoming, color: "rgb(96 165 250)" },
    { label: "Cancelled", value: cancelled, color: "rgb(248 113 113)" },
  ];

  // Stroke-dasharray donut: circumference for r=15.915 is ~100, so values map to % directly.
  const R = 15.915;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Bookings breakdown</p>
        <p className="text-xs text-zinc-500">{total} total</p>
      </div>

      {loading ? (
        <div className="mt-6 h-36 animate-pulse rounded-xl bg-white/5" />
      ) : total === 0 ? (
        <div className="mt-6 flex h-36 items-center justify-center text-sm text-zinc-600">
          No bookings yet.
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-6">
          <svg viewBox="0 0 42 42" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Bookings breakdown">
            <circle cx="21" cy="21" r={R} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="4" />
            {segments.map((s) => {
              if (s.value === 0) return null;
              const len = (s.value / total) * C;
              const dash = `${len} ${C - len}`;
              const circle = (
                <circle
                  key={s.label}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="4"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return circle;
            })}
            <text
              x="21"
              y="21"
              textAnchor="middle"
              dominantBaseline="central"
              className="rotate-90 fill-zinc-100 text-[7px] font-semibold"
              style={{ transformOrigin: "center" }}
            >
              {total}
            </text>
          </svg>

          <ul className="flex-1 space-y-2.5">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-medium text-zinc-100">
                  {s.value}
                  <span className="ml-1 text-xs text-zinc-500">
                    {total ? `(${Math.round((s.value / total) * 100)}%)` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
