"use client";

import { useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
import { createAdminUser, setAdminUserStatus, type AdminUser } from "@/lib/api";
import { invalidateAdminStaff, useAdminStaff } from "@/lib/swr-hooks";

const input = "field-input";

export default function AdminStaffPage() {
  const { user: sessionUser, isAdmin } = useAdminShell();
  const { data: staff = [], isLoading, error } = useAdminStaff();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");
  const [creating, setCreating] = useState(false);

  const selfId = sessionUser?.id ?? sessionUser?._id;

  async function onToggleStatus(u: AdminUser) {
    const id = u._id ?? u.id;
    if (!id) return;
    const next = u.status === "disabled" ? "active" : "disabled";
    setBusyId(id);
    setActionError("");
    try {
      await setAdminUserStatus(id, next);
      await invalidateAdminStaff();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update staff status");
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    if (mobile.replace(/\D/g, "").length !== 10) {
      setActionError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!name.trim()) {
      setActionError("Enter a name for the staff user.");
      return;
    }
    if (password.length < 8) {
      setActionError("Password must be at least 8 characters.");
      return;
    }
    setCreating(true);
    try {
      await createAdminUser({
        mobile: mobile.replace(/\D/g, ""),
        name: name.trim(),
        password,
        role,
      });
      setName("");
      setMobile("");
      setPassword("");
      setRole("employee");
      await invalidateAdminStaff();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create staff user");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Staff</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Admin & employees</h1>
      <p className="mt-1 text-sm text-zinc-400">
        People who can access this console. Employees can review KYC; admins can also manage staff
        and the catalog.
      </p>

      {actionError && (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {actionError}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-lg font-medium">Staff users</h2>
          <p className="mt-1 text-sm text-zinc-500">{staff.length} total</p>

          {isLoading ? (
            <div className="mt-6 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : error ? (
            <p className="mt-6 text-sm text-red-300">Couldn&apos;t load staff. Please refresh.</p>
          ) : staff.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">No staff users yet.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {staff.map((u) => {
                const id = u._id ?? u.id;
                const disabled = u.status === "disabled";
                const isSelf = id != null && id === selfId;
                return (
                  <li
                    key={id ?? u.mobile}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-200">
                        {u.name ?? "Unnamed"}
                        {isSelf && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
                      </p>
                      <p className="truncate text-zinc-500">
                        +91 {u.mobile ?? "—"} · {u.role ?? u.roles?.[0] ?? "employee"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`text-xs capitalize ${disabled ? "text-red-300" : "text-emerald-300"}`}>
                        {u.status ?? "active"}
                      </span>
                      {isAdmin && !isSelf && (
                        <button
                          type="button"
                          disabled={busyId === id}
                          onClick={() => onToggleStatus(u)}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 transition hover:bg-white/5 disabled:opacity-60"
                        >
                          {busyId === id ? "…" : disabled ? "Enable" : "Disable"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isAdmin ? (
          <form onSubmit={onCreate} className="glass rounded-2xl p-6">
            <h2 className="text-lg font-medium">Create staff user</h2>
            <p className="mt-1 text-sm text-zinc-500">Add an admin or employee account.</p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm text-zinc-400">
                Name
                <input
                  className={`${input} mt-2`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Mobile (+91)
                <input
                  className={`${input} mt-2`}
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Password
                <input
                  type="password"
                  className={`${input} mt-2`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-sm text-zinc-400">
                Role
                <select
                  className={`${input} mt-2`}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "employee" | "admin")}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={creating}
                className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create user"}
              </button>
            </div>
          </form>
        ) : (
          <div className="glass rounded-2xl p-6">
            <p className="text-sm text-zinc-500">Only admins can create or disable staff accounts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
