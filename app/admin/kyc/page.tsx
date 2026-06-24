"use client";

import { useMemo, useState } from "react";
import {
  filterAdminVendorKyc,
  reviewAdminVendorKyc,
  type AdminVendorKycRow,
  type KycOverallStatus,
} from "@/lib/api";
import { invalidateAdminKyc, useAdminVendorKyc } from "@/lib/swr-hooks";

const input = "field-input";

const FILTERS: { id: KycOverallStatus | "all"; label: string }[] = [
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

export default function AdminKycPage() {
  const { data: rows = [], isLoading, error, mutate } = useAdminVendorKyc();
  const [filter, setFilter] = useState<KycOverallStatus | "all">("pending_review");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const visible = useMemo(() => filterAdminVendorKyc(rows, filter), [rows, filter]);

  async function onApprove(vendorUserId: string) {
    setBusyId(vendorUserId);
    setActionError("");
    try {
      await reviewAdminVendorKyc(vendorUserId, "approve");
      await invalidateAdminKyc();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not approve KYC");
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(vendorUserId: string) {
    setBusyId(vendorUserId);
    setActionError("");
    try {
      await reviewAdminVendorKyc(vendorUserId, "reject", rejectReason);
      setRejectId(null);
      setRejectReason("");
      await invalidateAdminKyc();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reject KYC");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Vendor KYC</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Verification queue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Approve or reject vendor identity submissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              filter === f.id
                ? "bg-white/15 text-zinc-100"
                : "border border-white/10 text-zinc-400 hover:bg-white/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(actionError || error) && (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {actionError || "Could not load vendor KYC. Please refresh."}
        </p>
      )}

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="text-sm text-zinc-400">No vendor KYC submissions in this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((row) => (
              <KycCard
                key={row.userId}
                row={row}
                busy={busyId === row.userId}
                rejecting={rejectId === row.userId}
                rejectReason={rejectReason}
                onApprove={() => onApprove(row.userId)}
                onStartReject={() => {
                  setRejectId(row.userId);
                  setRejectReason("");
                }}
                onCancelReject={() => setRejectId(null)}
                onReasonChange={setRejectReason}
                onConfirmReject={() => onReject(row.userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KycCard({
  row,
  busy,
  rejecting,
  rejectReason,
  onApprove,
  onStartReject,
  onCancelReject,
  onReasonChange,
  onConfirmReject,
}: {
  row: AdminVendorKycRow;
  busy: boolean;
  rejecting: boolean;
  rejectReason: string;
  onApprove: () => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onReasonChange: (value: string) => void;
  onConfirmReject: () => void;
}) {
  return (
    <article className="glass rounded-2xl p-5 sm:p-6">
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
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusBadge(row.status)}`}
        >
          {row.status.replace("_", " ")}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        {(["aadhaar", "pan", "face"] as const).map((step) => (
          <div key={step} className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
            <dt className="capitalize text-zinc-500">{step}</dt>
            <dd className="mt-0.5 text-zinc-200">{stepLabel(row.kyc[step])}</dd>
          </div>
        ))}
      </dl>

      {row.rejectReason && (
        <p className="mt-4 text-sm text-red-200/90">Reason: {row.rejectReason}</p>
      )}

      {row.status === "pending_review" && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Working…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onStartReject}
            className="rounded-full border border-red-500/30 px-5 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {rejecting && (
        <div className="mt-4 space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <label className="block text-sm text-zinc-400">
            Rejection reason
            <input
              className={`${input} mt-2`}
              value={rejectReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Documents mismatch"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancelReject}
              className="flex-1 rounded-full border border-white/10 py-2 text-sm hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmReject}
              className="flex-1 rounded-full bg-red-500/20 py-2 text-sm font-medium text-red-100 hover:bg-red-500/30 disabled:opacity-60"
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
