"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import {
  updatePrintOrderStatus,
  type PrintOrder,
  type PrintOrderStatus,
} from "@/lib/api";
import { invalidateVendorPrintOrders, useVendorPrintOrders } from "@/lib/swr-hooks";
import { formatPrintOrderAttributes } from "@/lib/print-requirements";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const orderNo = (id: string) => `#${id.replace(/-/g, "").slice(-8).toUpperCase()}`;

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

const STATUS_STYLES: Record<string, string> = {
  accepted: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  pending_payment: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  confirmed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  in_production: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  ready: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  completed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  cancelled: "border-red-400/25 bg-red-400/10 text-red-300",
  expired: "border-red-400/25 bg-red-400/10 text-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  accepted: "Awaiting payment",
  pending_payment: "Payment started",
  confirmed: "Paid",
  in_production: "In production",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const NEXT_STATUS: Partial<Record<string, { status: PrintOrderStatus; label: string }>> = {
  confirmed: { status: "in_production", label: "Start production" },
  in_production: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Mark completed" },
};

export default function VendorPrintOrdersPage() {
  const { kycVerified, kyc } = useVendorShell();
  const { data, isLoading } = useVendorPrintOrders(kycVerified);
  const [error, setError] = useState("");

  const assigned = useMemo(() => data?.assigned ?? [], [data]);
  const hasPrintBusiness = data?.eligible.hasPrintBusiness ?? false;

  const stats = useMemo(() => {
    const awaiting = assigned.filter((o) =>
      ["accepted", "pending_payment"].includes(o.status),
    ).length;
    const active = assigned.filter((o) =>
      ["confirmed", "in_production", "ready"].includes(o.status),
    ).length;
    const completed = assigned.filter((o) => o.status === "completed").length;
    return { total: assigned.length, awaiting, active, completed };
  }, [assigned]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Verify your identity to receive print orders.
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

  const list = assigned;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Print on demand</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">Orders</span>
            </h1>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="All orders" value={stats.total} accent="sky" />
          <StatCard label="Awaiting payment" value={stats.awaiting} accent="amber" />
          <StatCard label="In progress" value={stats.active} accent="emerald" />
          <StatCard label="Completed" value={stats.completed} accent="zinc" />
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {!hasPrintBusiness && !isLoading && (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Set up a live <strong>Print on demand</strong> business to start receiving orders.{" "}
            <Link href="/business/businesses" className="underline">
              Onboard now →
            </Link>
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div className="scroll-pane mt-6 min-h-0 flex-1">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState text="No orders yet. Customers who order from your shop will appear here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assigned.map((order) => (
              <AssignedOrderCard key={order.id} order={order} onError={setError} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  sky: "text-sky-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  zinc: "text-zinc-200",
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: keyof typeof ACCENTS | string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className={`text-2xl font-semibold ${ACCENTS[accent] ?? "text-zinc-200"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14 text-center">
      <p className="text-3xl">🖨️</p>
      <p className="mt-3 max-w-sm text-sm text-zinc-400">{text}</p>
    </div>
  );
}

function AssignedOrderCard({
  order,
  onError,
}: {
  order: PrintOrder;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[order.status];
  const href = `/business/print-orders/${order.id}`;
  const attrs = formatPrintOrderAttributes(order.attributes);
  const telHref = order.customerMobile
    ? `tel:${order.customerMobile.replace(/\s/g, "")}`
    : null;
  const placed = shortDate(order.createdAt);
  const statusCls = STATUS_STYLES[order.status] ?? "border-white/10 bg-white/[0.03] text-zinc-300";

  async function advance() {
    if (!next) return;
    setBusy(true);
    onError("");
    try {
      await updatePrintOrderStatus(order.id, next.status);
      await invalidateVendorPrintOrders();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition hover:border-white/12 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-zinc-400">{orderNo(order.id)}</span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCls}`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      <Link href={href} className="mt-2 flex flex-1 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg">
          🖨️
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-100">
            {order.quantity} × {order.categoryLabel}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
            {[attrs, order.city].filter(Boolean).join(" · ")}
          </p>
          {(order.customerName || placed) && (
            <p className="mt-1.5 truncate text-xs text-zinc-400">
              {order.customerName || "Customer"}
              {placed ? ` · ${placed}` : ""}
            </p>
          )}
          {order.paymentRefId && (
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              {order.paymentRefId}
            </p>
          )}
        </div>
      </Link>

      {telHref && (
        <a
          href={telHref}
          className="mt-2 inline-flex w-fit items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
        >
          📞 {order.customerMobile}
        </a>
      )}

      {order.status === "accepted" && (
        <p className="mt-1.5 text-xs text-amber-300/80">Awaiting customer payment</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <span className="text-sm font-semibold text-emerald-300">{money(order.quoteAmount)}</span>
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void advance()}
            className="btn-primary shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60 sm:text-sm"
          >
            {busy ? "…" : next.label}
          </button>
        ) : (
          <span className="text-xs text-zinc-500">{STATUS_LABELS[order.status]}</span>
        )}
      </div>
    </article>
  );
}
