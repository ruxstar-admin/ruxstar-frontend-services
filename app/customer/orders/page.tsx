"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  listMyCommerceOrders,
  type CommerceOrder,
  type PrintOrder,
} from "@/lib/api";
import { useMyPrintOrders } from "@/lib/swr-hooks";
import { formatPrintOrderAttributes } from "@/lib/print-requirements";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const PAGE_HEADER =
  "shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const SCROLL_BODY = "scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8";

const STATUS: Record<string, { label: string; cls: string }> = {
  accepted: {
    label: "Pay now",
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
  preparing: {
    label: "Preparing",
    cls: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
  in_production: {
    label: "In production",
    cls: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  },
  ready: { label: "Ready for pickup", cls: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
  completed: {
    label: "Completed",
    cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  cancelled: { label: "Cancelled", cls: "border-red-400/25 bg-red-400/10 text-red-300" },
  expired: { label: "Expired", cls: "border-red-400/25 bg-red-400/10 text-red-300" },
};

type Unified =
  | { kind: "print"; order: PrintOrder; createdAt: string }
  | { kind: "commerce"; order: CommerceOrder; createdAt: string };

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? {
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
  const { data: printOrders = [], isLoading: printLoading } = useMyPrintOrders(true);
  const [commerceOrders, setCommerceOrders] = useState<CommerceOrder[]>([]);
  const [commerceLoading, setCommerceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listMyCommerceOrders();
        if (!cancelled) setCommerceOrders(list);
      } catch {
        if (!cancelled) setCommerceOrders([]);
      } finally {
        if (!cancelled) setCommerceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unified = useMemo(() => {
    const rows: Unified[] = [
      ...printOrders.map((order) => ({
        kind: "print" as const,
        order,
        createdAt: order.createdAt || "",
      })),
      ...commerceOrders.map((order) => ({
        kind: "commerce" as const,
        order,
        createdAt: order.createdAt || "",
      })),
    ];
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return rows;
  }, [printOrders, commerceOrders]);

  const isLoading = printLoading || commerceLoading;

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0a0a0b]/40">
      <div className={PAGE_HEADER}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">My orders</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Print and commerce orders in one place.</p>
          </div>
          {!isLoading && unified.length > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
              {unified.length} total
            </span>
          )}
        </div>
      </div>

      <div className={SCROLL_BODY}>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : unified.length === 0 ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <div>
              <p className="text-4xl">📦</p>
              <p className="mt-3 text-sm text-zinc-400">No orders yet.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/customer/print")}
                  className="btn-primary rounded-full px-5 py-2 text-sm font-semibold"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/customer/commerce")}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-zinc-200"
                >
                  Commerce
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unified.map((row) =>
              row.kind === "print" ? (
                <li key={`print-${row.order.id}`}>
                  <button
                    type="button"
                    onClick={() => router.push(`/customer/print/${row.order.id}`)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-left transition hover:border-white/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-600">Print</p>
                        <p className="mt-0.5 text-sm font-medium text-zinc-100">
                          {row.order.categoryLabel || row.order.title || "Print order"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {row.order.businessName || "Shop"}
                        </p>
                      </div>
                      <StatusBadge status={row.order.status} />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      {formatPrintOrderAttributes(row.order.attributes)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      {money(row.order.quoteAmount)}
                    </p>
                  </button>
                </li>
              ) : (
                <li key={`commerce-${row.order.id}`}>
                  <button
                    type="button"
                    onClick={() => router.push(`/customer/commerce/orders/${row.order.id}`)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-left transition hover:border-white/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                          Commerce
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-zinc-100">
                          {row.order.businessName || "Shop"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {row.order.items.length} item
                          {row.order.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <StatusBadge status={row.order.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                      {row.order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-emerald-300">
                      {money(row.order.amount)}
                    </p>
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
