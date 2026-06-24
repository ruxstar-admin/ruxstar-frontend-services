"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAdminShell } from "@/components/admin-shell";
import { useAdminCatalog, useAdminStaff, useAdminVendorKyc } from "@/lib/swr-hooks";

export default function AdminOverviewPage() {
  const { user, isAdmin } = useAdminShell();
  const { data: kyc = [], isLoading: kycLoading } = useAdminVendorKyc();
  const { data: staff = [] } = useAdminStaff();
  const { data: catalog } = useAdminCatalog(isAdmin);

  const stats = useMemo(() => {
    const pending = kyc.filter((r) => r.status === "pending_review");
    return {
      pending: pending.length,
      verified: kyc.filter((r) => r.status === "verified").length,
      vendors: kyc.length,
      staff: staff.length,
      categories: catalog?.categories.length ?? 0,
      types: catalog?.types.length ?? 0,
      recentPending: pending.slice(0, 5),
    };
  }, [kyc, staff, catalog]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Overview</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
        <span className="text-gradient">Welcome, {user?.name || "Admin"}</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-400">
        Review vendor verifications, manage the catalog, and oversee staff.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending KYC" value={stats.pending} accent="amber" loading={kycLoading} />
        <StatCard label="Verified vendors" value={stats.verified} accent="emerald" loading={kycLoading} />
        <StatCard label="Staff users" value={stats.staff} />
        {isAdmin ? (
          <StatCard label="Catalog types" value={stats.types} hint={`${stats.categories} categories`} />
        ) : (
          <StatCard label="Total in KYC" value={stats.vendors} />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_18rem]">
        {/* Pending review queue */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Awaiting review</p>
            <Link href="/admin/kyc" className="text-xs text-zinc-400 hover:text-zinc-200">
              View all →
            </Link>
          </div>

          {kycLoading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
          ) : stats.recentPending.length === 0 ? (
            <div className="mt-6 flex h-28 items-center justify-center text-sm text-zinc-600">
              Nothing waiting — all caught up. 🎉
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.recentPending.map((row) => (
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

        {/* Quick actions */}
        <div className="glass flex flex-col rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Quick actions</p>
          <div className="mt-4 flex flex-col gap-2">
            <QuickLink href="/admin/kyc" label="Review vendor KYC" icon="🪪" />
            {isAdmin && <QuickLink href="/admin/catalog" label="Manage catalog" icon="🗂" />}
            <QuickLink href="/admin/staff" label={isAdmin ? "Manage staff" : "View staff"} icon="👥" />
          </div>
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
  value: number;
  hint?: string;
  accent?: "amber" | "emerald";
  loading?: boolean;
}) {
  const color =
    accent === "amber"
      ? "text-amber-200"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-zinc-100";
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-white/5" />
      ) : (
        <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/5"
    >
      <span>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-zinc-500">→</span>
    </Link>
  );
}
