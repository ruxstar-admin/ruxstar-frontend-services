"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
import { EmptyState, LoadingRows, Pill } from "@/components/admin-ui";
import { setAdminUserStatus } from "@/lib/api";
import { invalidateAdminUsers, useAdminUserActivity, useAdminUserDetail } from "@/lib/swr-hooks";

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
          <p className="text-xs uppercase tracking-widest text-zinc-500">Recent payments (as vendor)</p>
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

      <CustomerActivity id={id} />
    </div>
  );
}

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";

function CustomerActivity({ id }: { id: string }) {
  const { data, isLoading } = useAdminUserActivity(id);
  if (isLoading && !data) {
    return (
      <div className="mt-8">
        <LoadingRows count={3} />
      </div>
    );
  }
  if (!data) return null;
  const { bookings, printOrders, payments } = data;
  const nothing = bookings.length === 0 && printOrders.length === 0 && payments.length === 0;

  return (
    <div className="mt-8 border-t border-white/5 pt-6">
      <h2 className="text-sm font-semibold text-zinc-200">Customer activity</h2>
      <p className="mt-0.5 text-xs text-zinc-500">
        Bookings, print orders and payments this user made as a customer.
      </p>

      {nothing ? (
        <div className="mt-4">
          <EmptyState text="No customer activity yet." icon="🧾" />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {bookings.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Bookings</p>
              <ul className="mt-2 space-y-2">
                {bookings.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-zinc-100">{b.businessName}</span>
                      <span className="shrink-0 text-sm font-medium text-emerald-300">
                        {money(b.amount ?? b.pricePerSlot)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-500">{dt(b.startAt)}</span>
                      <Pill label={b.status} tone={b.status === "cancelled" ? "red" : "green"} />
                      {b.refundStatus === "refunded" && <Pill label="Refunded" tone="sky" />}
                    </div>
                    {b.paymentRefId && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                        {b.paymentRefId}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {printOrders.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Print orders</p>
              <ul className="mt-2 space-y-2">
                {printOrders.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-zinc-100">
                        {o.quantity ? `${o.quantity} × ` : ""}
                        {o.categoryLabel}
                      </span>
                      {o.quoteAmount != null && (
                        <span className="shrink-0 text-sm font-medium text-emerald-300">
                          {money(o.quoteAmount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-500">{dt(o.createdAt)}</span>
                      <Pill label={o.status} tone={o.status === "cancelled" ? "red" : "zinc"} />
                      {o.refundStatus === "refunded" && <Pill label="Refunded" tone="sky" />}
                    </div>
                    {o.paymentRefId && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                        {o.paymentRefId}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payments.length > 0 && (
            <div className="lg:col-span-2">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Payments</p>
              <ul className="mt-2 space-y-2">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-mono text-xs text-zinc-400">{p.refId}</span>
                        {p.refundStatus === "refunded" ? (
                          <Pill label="Refunded" tone="red" />
                        ) : p.payoutRef ? (
                          <Pill label="Paid out" tone="sky" />
                        ) : null}
                      </div>
                      <p className="text-xs capitalize text-zinc-500">
                        {[p.source, dt(p.paidAt)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-medium ${
                        p.refundStatus === "refunded" ? "text-zinc-500 line-through" : "text-emerald-300"
                      }`}
                    >
                      {money(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
