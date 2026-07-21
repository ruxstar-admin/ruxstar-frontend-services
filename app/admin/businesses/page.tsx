"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { setAdminBusinessSuspended } from "@/lib/api";
import { invalidateAdminBusinesses, useAdminBusinesses } from "@/lib/swr-hooks";

const STATUS_TONE: Record<string, "green" | "amber" | "zinc"> = {
  live: "green",
  draft: "amber",
};

export default function AdminBusinessesPage() {
  const { isAdmin } = useAdminShell();
  const [search, setSearch] = useState(useSearchParams().get("search") ?? "");
  const [status, setStatus] = useState("");
  const [suspended, setSuspended] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      suspended: suspended || undefined,
      page,
      limit: 20,
    }),
    [debouncedSearch, status, suspended, page],
  );
  const { data, isLoading } = useAdminBusinesses(params);
  const businesses = data?.items ?? [];

  async function toggleSuspend(id: string, next: boolean) {
    if (next && !window.confirm("Suspend this business? It will be hidden and can't take new bookings.")) return;
    setBusyId(id);
    try {
      await setAdminBusinessSuspended(id, next);
      await invalidateAdminBusinesses();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Businesses" subtitle="Every business across all vendors." total={data?.total} />

      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, address or type…" />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "live", label: "Live" },
            { value: "draft", label: "Draft" },
          ]}
        />
        <Select
          ariaLabel="Suspension"
          value={suspended}
          onChange={(v) => { setSuspended(v); setPage(1); }}
          options={[
            { value: "", label: "All" },
            { value: "false", label: "Active only" },
            { value: "true", label: "Suspended only" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && businesses.length === 0 ? (
          <LoadingRows />
        ) : businesses.length === 0 ? (
          <EmptyState text="No businesses match these filters." icon="🏪" />
        ) : (
          <ul className="space-y-2">
            {businesses.map((b) => (
              <li
                key={b.id}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                  b.suspended ? "border-red-400/20 bg-red-400/[0.03]" : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-50">{b.name || "Untitled"}</span>
                    <Pill label={b.status} tone={STATUS_TONE[b.status] ?? "zinc"} />
                    {b.suspended && <Pill label="Suspended" tone="red" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[b.typeLabel || b.module, b.address, b.vendorName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {b.vendorId && (
                  <Link
                    href={`/admin/users/${b.vendorId}`}
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    Owner
                  </Link>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    disabled={busyId === b.id}
                    onClick={() => toggleSuspend(b.id, !b.suspended)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      b.suspended
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                        : "border-red-400/25 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                    }`}
                  >
                    {busyId === b.id ? "…" : b.suspended ? "Unsuspend" : "Suspend"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
