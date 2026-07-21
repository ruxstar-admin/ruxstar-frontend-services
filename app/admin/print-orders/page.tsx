"use client";

import { useMemo, useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
import {
  AdminHeader,
  EmptyState,
  LoadingRows,
  Pager,
  Pill,
  SearchBar,
  Select,
  Toolbar,
  useDebounced,
} from "@/components/admin-ui";
import { cancelAdminPrintOrder } from "@/lib/api";
import { invalidateAdminPrintOrders, useAdminPrintOrders } from "@/lib/swr-hooks";

const money = (n: number | null) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—");

const orderNo = (id: string) => `#${id.replace(/-/g, "").slice(-8).toUpperCase()}`;

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "violet" | "sky" | "zinc"> = {
  accepted: "amber",
  pending_payment: "amber",
  confirmed: "green",
  in_production: "violet",
  ready: "sky",
  completed: "green",
  cancelled: "red",
  expired: "red",
};

const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—";

export default function AdminPrintOrdersPage() {
  const { isAdmin } = useAdminShell();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, status: status || undefined, page, limit: 20 }),
    [debouncedSearch, status, page],
  );
  const { data, isLoading } = useAdminPrintOrders(params);
  const orders = data?.items ?? [];

  async function cancel(id: string) {
    if (!window.confirm("Force-cancel this print order?")) return;
    setBusyId(id);
    try {
      await cancelAdminPrintOrder(id);
      await invalidateAdminPrintOrders();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Print orders" subtitle="All print-on-demand orders across every shop." total={data?.total} />

      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search customer, product, payment id…" />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "accepted", label: "Awaiting payment" },
            { value: "confirmed", label: "Paid" },
            { value: "in_production", label: "In production" },
            { value: "ready", label: "Ready" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && orders.length === 0 ? (
          <LoadingRows />
        ) : orders.length === 0 ? (
          <EmptyState text="No orders match these filters." icon="🖨️" />
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const cancellable = !["completed", "cancelled", "expired"].includes(o.status);
              return (
                <li
                  key={o.id}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-zinc-400">{orderNo(o.id)}</span>
                      <span className="truncate font-medium text-zinc-50">
                        {o.quantity ? `${o.quantity} × ` : ""}
                        {o.categoryLabel || "Print order"}
                      </span>
                      <Pill label={o.status.replace("_", " ")} tone={STATUS_TONE[o.status] ?? "zinc"} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {[o.customerName, o.businessName, dt(o.createdAt)].filter(Boolean).join(" · ")}
                    </p>
                    {o.paymentRefId && (
                      <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                        {o.paymentRefId}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-medium text-zinc-100">{money(o.quoteAmount)}</span>
                  {isAdmin && cancellable && (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => cancel(o.id)}
                      className="shrink-0 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                    >
                      {busyId === o.id ? "…" : "Cancel"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
