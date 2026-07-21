"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { useAdminPayments, useAdminRevenue } from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const SOURCE_LABELS: Record<string, string> = {
  booking: "Bookings",
  event: "Events",
  print: "Print orders",
};

const SOURCE_TONE: Record<string, "green" | "violet" | "sky" | "zinc"> = {
  booking: "green",
  event: "violet",
  print: "sky",
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

export default function AdminPaymentsPage() {
  const { data: revenue } = useAdminRevenue(30);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, source: source || undefined, page, limit: 20 }),
    [debouncedSearch, source, page],
  );
  const { data, isLoading } = useAdminPayments(params);
  const payments = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Payments & revenue" subtitle="The unified payment ledger across Ruxstar." total={data?.total} />

      {/* Revenue summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Total revenue</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{money(revenue?.totals.amount ?? 0)}</p>
          <p className="mt-1 text-xs text-zinc-500">{revenue?.totals.count ?? 0} payments</p>
        </div>
        <div className="glass rounded-2xl p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-widest text-zinc-500">By source</p>
          <div className="mt-3 space-y-2">
            {(revenue?.bySource ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">No payments yet.</p>
            ) : (
              revenue?.bySource.map((s) => {
                const pct = revenue.totals.amount ? Math.round((s.amount / revenue.totals.amount) * 100) : 0;
                return (
                  <div key={s.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{SOURCE_LABELS[s.source] ?? s.source}</span>
                      <span className="font-medium text-zinc-100">
                        {money(s.amount)} <span className="text-zinc-500">· {pct}%</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-emerald-400/50" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top vendors */}
      {revenue && revenue.byVendor.length > 0 && (
        <div className="mt-4 glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Top vendors by revenue</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {revenue.byVendor.slice(0, 8).map((v, i) => (
              <li
                key={v.vendorId ?? i}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <span className="w-5 text-center text-xs text-zinc-500">{i + 1}</span>
                <Link
                  href={v.vendorId ? `/admin/users/${v.vendorId}` : "#"}
                  className="min-w-0 flex-1 truncate text-sm text-zinc-200 hover:text-white"
                >
                  {v.vendorName}
                </Link>
                <span className="shrink-0 text-sm font-medium text-emerald-300">{money(v.amount)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Ledger */}
      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search payment id or gateway ref…" />
        <Select
          ariaLabel="Source"
          value={source}
          onChange={(v) => { setSource(v); setPage(1); }}
          options={[
            { value: "", label: "All sources" },
            { value: "booking", label: "Bookings" },
            { value: "event", label: "Events" },
            { value: "print", label: "Print orders" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && payments.length === 0 ? (
          <LoadingRows />
        ) : payments.length === 0 ? (
          <EmptyState text="No payments match these filters." icon="💰" />
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono text-xs text-zinc-300">{p.refId}</span>
                    <Pill label={SOURCE_LABELS[p.source] ?? p.source} tone={SOURCE_TONE[p.source] ?? "zinc"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[dt(p.paidAt), p.gatewayPaymentId].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-emerald-300">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
