"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { PrintOrder } from "@/lib/api";
import { useMyPrintOrders } from "@/lib/swr-hooks";
import { formatPrintOrderAttributes } from "@/lib/print-requirements";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const PAGE_HEADER =
  "shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const SCROLL_BODY = "scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8";

const CUSTOMER_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Collecting quotes", cls: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
  accepted: {
    label: "Vendor chosen · pay now",
    cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  pending_payment: {
    label: "Payment started",
    cls: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  },
  confirmed: {
    label: "Confirmed",
    cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  in_production: {
    label: "In production",
    cls: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
  ready: { label: "Ready", cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  completed: {
    label: "Completed",
    cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  cancelled: { label: "Cancelled", cls: "border-red-400/25 bg-red-400/10 text-red-300" },
  expired: { label: "Expired", cls: "border-red-400/25 bg-red-400/10 text-red-300" },
};

function StatusBadge({ status }: { status: string }) {
  const s = CUSTOMER_STATUS[status] ?? {
    label: status,
    cls: "border-white/10 bg-white/[0.03] text-zinc-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { data: orders = [], isLoading } = useMyPrintOrders(true);

  const activeCount = useMemo(
    () => orders.filter((o) => o.status === "accepted" || o.status === "open").length,
    [orders],
  );

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0a0a0b]/40">
      <div className={PAGE_HEADER}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">My orders</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Track your print-on-demand orders.</p>
          </div>
          {!isLoading && orders.length > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {orders.length} total
            </span>
          )}
        </div>
      </div>

      <div className={SCROLL_BODY}>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <div>
              <p className="text-4xl">🖨️</p>
              <p className="mt-3 text-sm text-zinc-400">You haven&apos;t placed any print orders yet.</p>
              <button
                type="button"
                onClick={() => router.push("/customer/print")}
                className="btn-primary mt-5 rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                Start a print order
              </button>
            </div>
          </div>
        ) : (
          <div>
            {activeCount > 0 && (
              <p className="mb-3 text-sm text-amber-300/90">
                {activeCount} order{activeCount > 1 ? "s" : ""} need your attention.
              </p>
            )}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onOpen={() => router.push(`/customer/print/${order.id}`)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function OrderRow({ order, onOpen }: { order: PrintOrder; onOpen: () => void }) {
  const attrs = formatPrintOrderAttributes(order.attributes);
  const needsPay = order.status === "accepted";
  const quoteCount = order.quotes?.length ?? order.quoteCount ?? 0;
  const hasQuotesToPick = order.status === "open" && quoteCount > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex h-full min-h-[6.5rem] w-full flex-col rounded-2xl border p-4 text-left transition hover:bg-white/[0.04] ${
          needsPay
            ? "border-emerald-400/25 bg-emerald-400/[0.04]"
            : hasQuotesToPick
              ? "border-amber-400/25 bg-amber-400/[0.04]"
              : "border-white/8 bg-white/[0.02]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-zinc-100">
            {order.quantity} × {order.categoryLabel}
          </p>
          {order.quoteAmount != null && (
            <span className="shrink-0 text-sm font-semibold text-emerald-300">
              {money(order.quoteAmount)}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
          {[attrs, order.city].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <StatusBadge status={order.status} />
          <span
            className={`text-xs ${
              needsPay ? "text-emerald-300" : hasQuotesToPick ? "text-amber-300" : "text-zinc-500"
            }`}
          >
            {needsPay
              ? "Pay now →"
              : hasQuotesToPick
                ? `${quoteCount} quote${quoteCount > 1 ? "s" : ""} · choose →`
                : "View →"}
          </span>
        </div>
      </button>
    </li>
  );
}
