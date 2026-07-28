"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import {
  listVendorCommerceOrders,
  updateVendorCommerceOrderStatus,
  type CommerceOrder,
} from "@/lib/api";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const orderNo = (id: string) => `#${id.replace(/-/g, "").slice(-8).toUpperCase()}`;

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Paid",
  preparing: "Preparing",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_STYLES: Record<string, string> = {
  pending_payment: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  confirmed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  preparing: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  ready: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  completed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  cancelled: "border-red-400/25 bg-red-400/10 text-red-300",
};

const NEXT: Partial<Record<string, { status: string; label: string }>> = {
  confirmed: { status: "preparing", label: "Start preparing" },
  preparing: { status: "ready", label: "Mark ready for pickup" },
  ready: { status: "completed", label: "Mark completed" },
};

export default function VendorCommerceOrdersPage() {
  const { kycVerified, kyc } = useVendorShell();
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setOrders(await listVendorCommerceOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (kycVerified) void refresh();
  }, [kycVerified]);

  const stats = useMemo(() => {
    const active = orders.filter((o) =>
      ["confirmed", "preparing", "ready"].includes(o.status),
    ).length;
    const completed = orders.filter((o) => o.status === "completed").length;
    return { total: orders.length, active, completed };
  }, [orders]);

  async function advance(order: CommerceOrder) {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    setError("");
    try {
      const updated = await updateVendorCommerceOrderStatus(order.id, next.status);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setBusyId("");
    }
  }

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Verify your identity to manage commerce orders.
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
        <p className="text-xs uppercase tracking-widest text-zinc-500">Commerce</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          <span className="text-gradient">Orders</span>
        </h1>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-4">
            <p className="text-xs text-zinc-500">All</p>
            <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs text-zinc-500">In progress</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats.active}</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs text-zinc-500">Completed</p>
            <p className="mt-1 text-2xl font-semibold">{stats.completed}</p>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="scroll-pane mt-6 min-h-0 flex-1">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
            <p className="text-3xl">🛍️</p>
            <p className="mt-3 text-sm text-zinc-400">No paid commerce orders yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const next = NEXT[order.status];
              return (
                <li
                  key={order.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">
                        {orderNo(order.id)} · {order.businessName}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {order.customerName || "Customer"}
                        {order.paymentStatus === "paid" && order.customerMobile
                          ? ` · ${order.customerMobile}`
                          : ""}
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          STATUS_STYLES[order.status] || "border-white/10 text-zinc-300"
                        }`}
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                      <p className="mt-2 text-sm font-semibold text-emerald-300">
                        {money(order.amount)}
                      </p>
                    </div>
                  </div>
                  {next && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void advance(order)}
                      className="btn-primary mt-3 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {busyId === order.id ? "Updating…" : next.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
