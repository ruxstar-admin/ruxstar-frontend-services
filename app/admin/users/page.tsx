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
import { setAdminUserStatus } from "@/lib/api";
import { invalidateAdminUsers, useAdminUsersList } from "@/lib/swr-hooks";

const ROLE_TONE: Record<string, "green" | "amber" | "violet" | "sky" | "zinc"> = {
  admin: "violet",
  employee: "sky",
  vendor: "green",
  customer: "zinc",
  delivery: "amber",
};

export default function AdminUsersPage() {
  const { isAdmin } = useAdminShell();
  const initialRole = useSearchParams().get("role") ?? "";
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, role: role || undefined, status: status || undefined, page, limit: 20 }),
    [debouncedSearch, role, status, page],
  );
  const { data, isLoading } = useAdminUsersList(params);
  const users = data?.items ?? [];

  async function toggle(id: string, next: "active" | "disabled") {
    setBusyId(id);
    try {
      await setAdminUserStatus(id, next);
      await invalidateAdminUsers();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Users & vendors" subtitle="Every account on Ruxstar." total={data?.total} />

      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, mobile or member id…" />
        <Select
          ariaLabel="Role"
          value={role}
          onChange={(v) => { setRole(v); setPage(1); }}
          options={[
            { value: "", label: "All roles" },
            { value: "customer", label: "Customers" },
            { value: "vendor", label: "Vendors" },
            { value: "admin", label: "Admins" },
            { value: "employee", label: "Employees" },
            { value: "delivery", label: "Delivery" },
          ]}
        />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && users.length === 0 ? (
          <LoadingRows />
        ) : users.length === 0 ? (
          <EmptyState text="No users match these filters." icon="🔍" />
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const id = u.id ?? u._id ?? "";
              const primaryRole = (u.roles?.[0] ?? u.role ?? "customer").toLowerCase();
              const disabled = u.status === "disabled";
              return (
                <li
                  key={id}
                  className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/users/${id}`} className="truncate font-medium text-zinc-50 hover:text-white">
                        {u.name || "Unnamed"}
                      </Link>
                      <Pill label={primaryRole} tone={ROLE_TONE[primaryRole] ?? "zinc"} />
                      {disabled && <Pill label="Disabled" tone="red" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {u.mobile ? `+91 ${u.mobile}` : "No mobile"}
                    </p>
                  </div>
                  <Link
                    href={`/admin/users/${id}`}
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    View
                  </Link>
                  {isAdmin && primaryRole !== "admin" && (
                    <button
                      type="button"
                      disabled={busyId === id}
                      onClick={() => toggle(id, disabled ? "active" : "disabled")}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                        disabled
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
                          : "border-red-400/25 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                      }`}
                    >
                      {busyId === id ? "…" : disabled ? "Enable" : "Disable"}
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
