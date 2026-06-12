"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  createAdminUser,
  fetchAllAdminVendorKyc,
  filterAdminVendorKyc,
  getAdminVendorKyc,
  getUserRole,
  isStaffUser,
  listAdminUsers,
  reviewAdminVendorKyc,
  setAdminUserStatus,
  type AdminUser,
  type AdminVendorKycRow,
  type KycOverallStatus,
} from "@/lib/api";

const input = "field-input";

const kycFilters: { id: KycOverallStatus | "all"; label: string }[] = [
  { id: "pending_review", label: "Pending review" },
  { id: "in_progress", label: "In progress" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function statusBadge(status: KycOverallStatus | string | undefined) {
  const value = status?.toLowerCase();
  if (value === "verified") return "text-emerald-300 bg-emerald-500/10 border-emerald-500/25";
  if (value === "pending_review") return "text-amber-200 bg-amber-500/10 border-amber-500/25";
  if (value === "rejected") return "text-red-200 bg-red-500/10 border-red-500/25";
  if (value === "in_progress") return "text-sky-200 bg-sky-500/10 border-sky-500/25";
  return "text-zinc-300 bg-white/5 border-white/10";
}

function stepLabel(step?: { status?: string; verified?: boolean }) {
  if (step?.verified || step?.status === "verified") return "Verified";
  if (step?.status === "failed") return "Failed";
  if (step?.status === "in_progress") return "In progress";
  return "Pending";
}

export default function AdminPage() {
  const router = useRouter();
  const { user: sessionUser, ready } = useRequireAuth({ staff: true });
  const [tab, setTab] = useState<"kyc" | "staff">("kyc");
  const [kycFilter, setKycFilter] = useState<KycOverallStatus | "all">("pending_review");
  const [allKycRows, setAllKycRows] = useState<AdminVendorKycRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [staffMobile, setStaffMobile] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<"employee" | "admin">("employee");
  const [creatingStaff, setCreatingStaff] = useState(false);

  const adminName = sessionUser?.name ?? "Admin";
  const isAdmin = getUserRole(sessionUser) === "admin";

  const kycRows = useMemo(
    () => filterAdminVendorKyc(allKycRows, kycFilter),
    [allKycRows, kycFilter],
  );

  const loadKyc = useCallback(async () => {
    const rows = await fetchAllAdminVendorKyc();
    setAllKycRows(rows);
    setPendingCount(rows.filter((row) => row.status === "pending_review").length);
  }, []);

  const loadStaff = useCallback(async () => {
    const [admins, employees] = await Promise.all([
      listAdminUsers("admin"),
      listAdminUsers("employee"),
    ]);
    const byId = new Map<string, AdminUser>();
    for (const u of [...admins, ...employees]) {
      byId.set(u._id ?? u.id ?? u.mobile ?? Math.random().toString(), u);
    }
    setStaff([...byId.values()]);
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      await Promise.all([loadKyc(), loadStaff()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, [loadKyc, loadStaff]);

  async function onToggleStaffStatus(user: AdminUser) {
    const id = user._id ?? user.id;
    if (!id) return;
    const next = user.status === "disabled" ? "active" : "disabled";
    setBusyId(id);
    setError("");
    try {
      await setAdminUserStatus(id, next);
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update staff status");
    } finally {
      setBusyId(null);
    }
  }

  async function onRefreshKycRow(vendorUserId: string) {
    setBusyId(vendorUserId);
    setError("");
    try {
      const fresh = await getAdminVendorKyc(vendorUserId);
      setAllKycRows((rows) =>
        rows.map((row) => (row.userId === vendorUserId ? fresh : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh vendor KYC");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!ready) return;
    refresh();
  }, [ready, refresh]);

  async function onApprove(vendorUserId: string) {
    setBusyId(vendorUserId);
    setError("");
    try {
      await reviewAdminVendorKyc(vendorUserId, "approve");
      await loadKyc();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve KYC");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(vendorUserId: string) {
    setBusyId(vendorUserId);
    setError("");
    try {
      await reviewAdminVendorKyc(vendorUserId, "reject", rejectReason);
      setRejectId(null);
      setRejectReason("");
      await loadKyc();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject KYC");
    } finally {
      setBusyId(null);
    }
  }

  async function onCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (staffMobile.replace(/\D/g, "").length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!staffName.trim()) {
      setError("Enter a name for the staff user.");
      return;
    }
    if (staffPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setCreatingStaff(true);
    try {
      await createAdminUser({
        mobile: staffMobile.replace(/\D/g, ""),
        name: staffName.trim(),
        password: staffPassword,
        role: staffRole,
      });
      setStaffMobile("");
      setStaffName("");
      setStaffPassword("");
      setStaffRole("employee");
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create staff user");
    } finally {
      setCreatingStaff(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/50">Loading admin dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <Link href="/admin" className="text-lg font-semibold tracking-tight">
            Ruxstar Admin
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500">Signed in as {adminName}</p>
        </div>
        <LogoutButton />
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="reveal mb-8 grid gap-4 sm:grid-cols-3">
          <div className="glass rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Pending KYC</p>
            <p className="mt-2 text-3xl font-semibold text-amber-100">{pendingCount}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-zinc-500">In this view</p>
            <p className="mt-2 text-3xl font-semibold">{kycRows.length}</p>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Staff users</p>
            <p className="mt-2 text-3xl font-semibold">{staff.length}</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2 rounded-full border border-white/10 p-1">
          {(["kyc", "staff"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-full py-2 text-sm transition ${
                tab === id ? "bg-white/15 font-medium" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {id === "kyc" ? "Vendor KYC" : "Staff"}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {tab === "kyc" && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {kycFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setKycFilter(filter.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                    kycFilter === filter.id
                      ? "bg-white/15 text-zinc-100"
                      : "border border-white/10 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => refresh()}
                className="ml-auto rounded-full border border-white/10 px-4 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-center text-sm text-zinc-500">Loading vendors…</p>
            ) : kycRows.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <p className="text-sm text-zinc-400">No vendor KYC submissions in this filter.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {kycRows.map((row) => (
                  <article key={row.userId} className="glass rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-medium text-zinc-100">
                          {row.name ?? row.businessName ?? "Vendor"}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500">
                          {row.mobile ? `+91 ${row.mobile}` : "No mobile"}
                          {row.businessName ? ` · ${row.businessName}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusBadge(row.status)}`}
                        >
                          {row.status.replace("_", " ")}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === row.userId}
                          onClick={() => onRefreshKycRow(row.userId)}
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:bg-white/5 disabled:opacity-60"
                          title="Pull the latest status for this vendor"
                        >
                          {busyId === row.userId ? "…" : "Refresh"}
                        </button>
                      </div>
                    </div>

                    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                        <dt className="text-zinc-500">Aadhaar</dt>
                        <dd className="mt-0.5 text-zinc-200">{stepLabel(row.kyc.aadhaar)}</dd>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                        <dt className="text-zinc-500">PAN</dt>
                        <dd className="mt-0.5 text-zinc-200">{stepLabel(row.kyc.pan)}</dd>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                        <dt className="text-zinc-500">Face</dt>
                        <dd className="mt-0.5 text-zinc-200">{stepLabel(row.kyc.face)}</dd>
                      </div>
                    </dl>

                    {row.rejectReason && (
                      <p className="mt-4 text-sm text-red-200/90">Reason: {row.rejectReason}</p>
                    )}

                    {row.status === "pending_review" && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={busyId === row.userId}
                          onClick={() => onApprove(row.userId)}
                          className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          {busyId === row.userId ? "Working…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === row.userId}
                          onClick={() => {
                            setRejectId(row.userId);
                            setRejectReason("");
                          }}
                          className="rounded-full border border-red-500/30 px-5 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {rejectId === row.userId && (
                      <div className="mt-4 space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                        <label className="block text-sm text-zinc-400">
                          Rejection reason
                          <input
                            className={`${input} mt-2`}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Documents mismatch"
                          />
                        </label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setRejectId(null)}
                            className="flex-1 rounded-full border border-white/10 py-2 text-sm hover:bg-white/5"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.userId}
                            onClick={() => onReject(row.userId)}
                            className="flex-1 rounded-full bg-red-500/20 py-2 text-sm font-medium text-red-100 hover:bg-red-500/30 disabled:opacity-60"
                          >
                            Confirm reject
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "staff" && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-medium">Staff users</h2>
              <p className="mt-1 text-sm text-zinc-500">Employees who can access the admin panel.</p>

              {staff.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-500">No staff users yet.</p>
              ) : (
                <ul className="mt-6 space-y-3">
                  {staff.map((user) => {
                    const id = user._id ?? user.id;
                    const disabled = user.status === "disabled";
                    const isSelf = id != null && id === (sessionUser?.id ?? sessionUser?._id);
                    return (
                      <li
                        key={id ?? user.mobile}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-zinc-200">{user.name ?? "Unnamed"}</p>
                          <p className="text-zinc-500">
                            +91 {user.mobile ?? "—"} · {user.role ?? user.roles?.[0] ?? "employee"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs capitalize ${
                              disabled ? "text-red-300" : "text-emerald-300"
                            }`}
                          >
                            {user.status ?? "active"}
                          </span>
                          {isAdmin && !isSelf && (
                            <button
                              type="button"
                              disabled={busyId === id}
                              onClick={() => onToggleStaffStatus(user)}
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

            {isAdmin && (
              <form onSubmit={onCreateStaff} className="glass rounded-2xl p-6">
                <h2 className="text-lg font-medium">Create staff user</h2>
                <p className="mt-1 text-sm text-zinc-500">Add an admin or employee account.</p>

                <div className="mt-6 space-y-4">
                  <label className="block text-sm text-zinc-400">
                    Name
                    <input
                      className={`${input} mt-2`}
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Mobile (+91)
                    <input
                      className={`${input} mt-2`}
                      inputMode="numeric"
                      value={staffMobile}
                      onChange={(e) =>
                        setStaffMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Password
                    <input
                      type="password"
                      className={`${input} mt-2`}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block text-sm text-zinc-400">
                    Role
                    <select
                      className={`${input} mt-2`}
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value as "employee" | "admin")}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={creatingStaff}
                    className="btn-primary w-full rounded-full py-3 text-sm font-semibold disabled:opacity-60"
                  >
                    {creatingStaff ? "Creating…" : "Create user"}
                  </button>
                </div>
              </form>
            )}

            {!isAdmin && (
              <div className="glass rounded-2xl p-6">
                <p className="text-sm text-zinc-500">
                  Only admins can create new staff accounts.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
