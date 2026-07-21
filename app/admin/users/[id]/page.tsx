"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
import { EmptyState, LoadingRows, Pill } from "@/components/admin-ui";
import { setAdminUserStatus } from "@/lib/api";
import { invalidateAdminUsers, useAdminUserDetail } from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const BUSINESS_TONE: Record<string, "green" | "amber" | "red" | "zinc"> = {
  live: "green",
  draft: "amber",
};

export default function AdminUserDetailPage() {
  const { isAdmin } = useAdminShell();
  const id = String(useParams().id ?? "");
  const { data, isLoading } = useAdminUserDetail(id);
  const [busy, setBusy] = useState(false);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <LoadingRows count={4} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState text="User not found." icon="👤" />
      </div>
    );
  }

  const { user, businesses, revenue, recentPayments } = data;
  const primaryRole = (user.roles?.[0] ?? user.role ?? "customer").toLowerCase();
  const disabled = user.status === "disabled";

  async function toggle() {
    setBusy(true);
    try {
      await setAdminUserStatus(id, disabled ? "active" : "disabled");
      await invalidateAdminUsers();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/users" className="text-xs text-zinc-400 hover:text-zinc-200">
        ← Back to users
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-50">{user.name || "Unnamed"}</h1>
            <Pill label={primaryRole} tone="violet" />
            {disabled && <Pill label="Disabled" tone="red" />}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {user.mobile ? `+91 ${user.mobile}` : "No mobile"}
            {user.refId ? ` · ${user.refId}` : ""}
          </p>
        </div>
        {isAdmin && primaryRole !== "admin" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggle()}
            className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              disabled
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                : "border-red-400/25 bg-red-400/10 text-red-300 hover:bg-red-400/20"
            }`}
          >
            {busy ? "…" : disabled ? "Enable account" : "Disable account"}
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Lifetime revenue</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{money(revenue.amount)}</p>
          <p className="mt-1 text-xs text-zinc-500">{revenue.count} payments</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{businesses.length}</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Status</p>
          <p className={`mt-2 text-2xl font-semibold ${disabled ? "text-red-300" : "text-emerald-300"}`}>
            {disabled ? "Disabled" : "Active"}
          </p>
        </div>
      </div>

      {businesses.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Businesses</p>
          <ul className="mt-3 space-y-2">
            {businesses.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-100">{b.name}</span>
                    <Pill label={b.status} tone={BUSINESS_TONE[b.status] ?? "zinc"} />
                    {b.suspended && <Pill label="Suspended" tone="red" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[b.typeLabel, b.address].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Link
                  href={`/admin/businesses?search=${encodeURIComponent(b.name)}`}
                  className="shrink-0 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Manage →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentPayments.length > 0 && (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Recent payments</p>
          <ul className="mt-3 space-y-2">
            {recentPayments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-zinc-400">{p.refId}</p>
                  <p className="text-xs text-zinc-500 capitalize">{p.source}</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-emerald-300">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
