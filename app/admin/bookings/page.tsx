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
import { cancelAdminBooking } from "@/lib/api";
import { invalidateAdminBookings, useAdminBookings } from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "zinc"> = {
  confirmed: "green",
  pending_payment: "amber",
  cancelled: "red",
  expired: "red",
  payment_failed: "red",
};

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

export default function AdminBookingsPage() {
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
  const { data, isLoading } = useAdminBookings(params);
  const bookings = data?.items ?? [];

  async function cancel(id: string) {
    if (!window.confirm("Force-cancel this booking?")) return;
    setBusyId(id);
    try {
      await cancelAdminBooking(id);
      await invalidateAdminBookings();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Bookings" subtitle="All slot bookings across every business." total={data?.total} />

      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search ref id, customer, phone…" />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "confirmed", label: "Confirmed" },
            { value: "cancelled", label: "Cancelled" },
            { value: "pending_payment", label: "Pending payment" },
            { value: "expired", label: "Expired" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && bookings.length === 0 ? (
          <LoadingRows />
        ) : bookings.length === 0 ? (
          <EmptyState text="No bookings match these filters." icon="📦" />
        ) : (
          <ul className="space-y-2">
            {bookings.map((b) => {
              const cancellable = b.status === "confirmed" || b.status === "pending_payment";
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-zinc-50">{b.customerName || "Customer"}</span>
                      <Pill label={b.status.replace("_", " ")} tone={STATUS_TONE[b.status] ?? "zinc"} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {[b.businessName, b.serviceLabel || b.resourceName, dt(b.startAt)].filter(Boolean).join(" · ")}
                    </p>
                    {b.refId && (
                      <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                        {b.refId}
                        {b.paymentRefId ? ` · ${b.paymentRefId}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-medium text-zinc-100">{money(b.amount)}</span>
                  {isAdmin && cancellable && (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => cancel(b.id)}
                      className="shrink-0 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                    >
                      {busyId === b.id ? "…" : "Cancel"}
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
