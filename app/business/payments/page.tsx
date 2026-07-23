"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import { useVendorLedger, invalidateVendorLedger } from "@/lib/swr-hooks";
import {
  requestVendorWithdrawal,
  updateVendorPayoutMethod,
  type VendorPayment,
  type Withdrawal,
  type PayoutMethod,
  type PayoutMethodInput,
} from "@/lib/api";

type Filter = "all" | "holding" | "withdrawable" | "processing" | "withdrawn" | "refunded";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "holding", label: "In refund window" },
  { id: "withdrawable", label: "Withdrawable" },
  { id: "processing", label: "Processing" },
  { id: "withdrawn", label: "Withdrawn" },
  { id: "refunded", label: "Refunded" },
];

const SOURCE_LABEL: Record<string, string> = {
  booking: "Slot booking",
  print: "Print order",
  event: "Event",
};

const WITHDRAWAL_LABEL: Record<Withdrawal["status"], string> = {
  pending: "Awaiting approval",
  processing: "Processing",
  completed: "Paid",
  failed: "Failed",
  rejected: "Rejected",
};

function formatINR(n: number) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

function dateLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// A single payment's lifecycle stage for the vendor's view.
function stageOf(p: VendorPayment): Filter {
  if (p.status === "refunded" || p.refundStatus === "refunded") return "refunded";
  if (p.payoutRef) return "withdrawn";
  if (p.withdrawalStatus === "processing") return "processing";
  if (p.matured) return "withdrawable";
  return "holding";
}

export default function VendorPaymentsPage() {
  const { kycVerified } = useVendorShell();
  const { data, isLoading, error } = useVendorLedger(kycVerified);
  const [filter, setFilter] = useState<Filter>("all");

  const payments = useMemo(() => data?.payments ?? [], [data]);
  const summary = data?.summary;
  const totals = summary?.totals;

  const rows = useMemo(() => {
    const list = payments.filter((p) => (filter === "all" ? true : stageOf(p) === filter));
    return [...list].sort(
      (a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime(),
    );
  }, [payments, filter]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Payments unlock after identity verification.
          </p>
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Go to KYC verification
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col">
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Payments</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Earnings & withdrawals</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Customer payments show up here instantly. After 7 days they mature and become available to
          withdraw. Withdrawals are paid out once a week after admin approval.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard label="Total earned" value={formatINR(totals?.earned ?? 0)} accent />
          <SummaryCard label="Available to withdraw" value={formatINR(totals?.withdrawable ?? 0)} highlight />
          <SummaryCard label="In refund window" value={formatINR(totals?.holding ?? 0)} />
          <SummaryCard label="Being processed" value={formatINR(totals?.inProcess ?? 0)} />
          <SummaryCard label="Withdrawn" value={formatINR(totals?.withdrawn ?? 0)} muted />
        </div>

        {summary && <WithdrawPanel summary={summary} />}

        <div className="mt-6 flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="field-input h-9 w-full py-0 text-sm text-zinc-100 sm:w-52"
            aria-label="Filter payments"
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="scroll-pane min-h-0 flex-1 pt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8 text-center text-sm text-red-300">
            Couldn&apos;t load payments. Please refresh.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-3xl">💳</p>
            <p className="mt-3 text-sm text-zinc-300">
              {filter === "refunded"
                ? "No refunds yet."
                : filter === "withdrawn"
                  ? "Nothing has been withdrawn yet."
                  : filter === "withdrawable"
                    ? "No matured funds available to withdraw yet."
                    : filter === "processing"
                      ? "No withdrawals are being processed."
                      : filter === "holding"
                        ? "No payments are in the refund window."
                        : "No payments yet. They'll appear here once customers pay."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2 pb-4">
            {rows.map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Withdraw panel ------------------------------ */

function WithdrawPanel({ summary }: { summary: NonNullable<ReturnType<typeof useVendorLedger>["data"]>["summary"] }) {
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const method = summary.payoutMethod;
  const active = summary.activeWithdrawal;
  const withdrawable = summary.totals.withdrawable;

  const onWithdraw = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      await requestVendorWithdrawal();
      await invalidateVendorLedger();
      setMsg({ kind: "ok", text: "Withdrawal requested. We'll process it after admin approval." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Could not request withdrawal." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass mt-6 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Withdraw earnings</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{formatINR(withdrawable)}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">available now (matured past the 7-day refund window)</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {active ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              {WITHDRAWAL_LABEL[active.status]} · {formatINR(active.amount)}
            </span>
          ) : (
            <button
              type="button"
              onClick={onWithdraw}
              disabled={submitting || withdrawable <= 0 || !method}
              className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? "Requesting…" : "Withdraw full balance"}
            </button>
          )}
          {!method && (
            <p className="text-[11px] text-amber-300">Add payout details to withdraw</p>
          )}
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-4 border-t border-white/5 pt-4">
        {editing || !method ? (
          <PayoutMethodForm
            method={method}
            onDone={() => setEditing(false)}
            allowCancel={!!method}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="text-zinc-300">
                {method.type === "vpa" ? (
                  <>UPI · <span className="font-mono">{method.vpa}</span></>
                ) : (
                  <>
                    {method.accountName ? `${method.accountName} · ` : ""}
                    <span className="font-mono">{method.accountNumberMasked}</span>
                    {method.ifsc ? ` · ${method.ifsc}` : ""}
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Funds are transferred to this account.</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5"
            >
              Change details
            </button>
          </div>
        )}
      </div>

      {summary.withdrawals.length > 0 && <WithdrawalsHistory withdrawals={summary.withdrawals} />}
    </div>
  );
}

function PayoutMethodForm({
  method,
  onDone,
  allowCancel,
}: {
  method: PayoutMethod | null;
  onDone: () => void;
  allowCancel: boolean;
}) {
  const [type, setType] = useState<"bank" | "vpa">(method?.type ?? "bank");
  const [accountName, setAccountName] = useState(method?.accountName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState(method?.ifsc ?? "");
  const [vpa, setVpa] = useState(method?.vpa ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload: PayoutMethodInput =
        type === "vpa"
          ? { type, vpa: vpa.trim() }
          : { type, accountName: accountName.trim(), accountNumber: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() };
      await updateVendorPayoutMethod(payload);
      await invalidateVendorLedger();
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not save details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        {(["bank", "vpa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              type === t ? "bg-emerald-400/15 text-emerald-300" : "border border-white/10 text-zinc-300"
            }`}
          >
            {t === "bank" ? "Bank account" : "UPI"}
          </button>
        ))}
      </div>

      {type === "bank" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="field-input text-sm"
            placeholder="Account holder name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <input
            className="field-input text-sm"
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
            inputMode="numeric"
          />
          <input
            className="field-input text-sm uppercase sm:col-span-2"
            placeholder="IFSC code"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
          />
        </div>
      ) : (
        <input
          className="field-input text-sm"
          placeholder="name@bank"
          value={vpa}
          onChange={(e) => setVpa(e.target.value)}
        />
      )}

      {err && <p className="text-xs text-red-300">{err}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary rounded-full px-5 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save payout details"}
        </button>
        {allowCancel && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function WithdrawalsHistory({ withdrawals }: { withdrawals: Withdrawal[] }) {
  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Withdrawal history</p>
      <ul className="mt-2 space-y-1.5">
        {withdrawals.slice(0, 6).map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                {w.withdrawalRef}
              </span>
              <span className="ml-2 text-[11px] text-zinc-500">
                {dateLabel(w.completedAt ?? w.requestedAt ?? w.createdAt)}
              </span>
              {w.status === "failed" && w.failureReason && (
                <span className="ml-2 text-[11px] text-red-300">{w.failureReason}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-semibold text-zinc-100">{formatINR(w.amount)}</span>
              <WithdrawalBadge status={w.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WithdrawalBadge({ status }: { status: Withdrawal["status"] }) {
  const cls =
    status === "completed"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : status === "failed" || status === "rejected"
        ? "border-red-400/25 bg-red-400/10 text-red-300"
        : "border-amber-400/25 bg-amber-400/10 text-amber-300";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {WITHDRAWAL_LABEL[status]}
    </span>
  );
}

/* --------------------------------- Cards/rows -------------------------------- */

function SummaryCard({
  label,
  value,
  accent,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          accent
            ? "text-emerald-300"
            : highlight
              ? "text-sky-300"
              : muted
                ? "text-zinc-500"
                : "text-zinc-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const STAGE_UI: Record<Filter, { label: string; icon: string; badge: string; icon_bg: string }> = {
  refunded: {
    label: "Refunded",
    icon: "↩",
    badge: "border-red-400/25 bg-red-400/10 text-red-300",
    icon_bg: "bg-red-400/10 text-red-300",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: "✓",
    badge: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    icon_bg: "bg-sky-400/10 text-sky-300",
  },
  processing: {
    label: "Processing",
    icon: "⏳",
    badge: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    icon_bg: "bg-amber-400/10 text-amber-300",
  },
  withdrawable: {
    label: "Withdrawable",
    icon: "₹",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    icon_bg: "bg-emerald-400/10 text-emerald-300",
  },
  holding: {
    label: "In refund window",
    icon: "•",
    badge: "border-zinc-400/25 bg-zinc-400/10 text-zinc-300",
    icon_bg: "bg-zinc-400/10 text-zinc-300",
  },
  all: { label: "", icon: "₹", badge: "", icon_bg: "" },
};

function PaymentRow({ payment }: { payment: VendorPayment }) {
  const stage = stageOf(payment);
  const ui = STAGE_UI[stage];
  const sourceLabel = SOURCE_LABEL[payment.source] || "Payment";
  const ref = payment.refId;
  const refunded = stage === "refunded";

  return (
    <li className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm ${ui.icon_bg}`}
        aria-hidden
      >
        {ui.icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-50">{sourceLabel}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{dateLabel(payment.paidAt)}</p>
        {(ref || payment.payoutRef || payment.withdrawalRef) && (
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            {[ref, payment.payoutRef ?? payment.withdrawalRef].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-sm font-semibold ${refunded ? "text-zinc-500 line-through" : "text-zinc-100"}`}
        >
          {formatINR(payment.amount)}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${ui.badge}`}>
          {ui.label}
        </span>
      </div>
    </li>
  );
}
