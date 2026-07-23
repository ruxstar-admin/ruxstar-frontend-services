"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
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
import { useAdminShell } from "@/components/admin-shell";
import {
  approveAdminWithdrawal,
  rejectAdminWithdrawal,
  refreshAdminWithdrawal,
  previewAdminVendorPayout,
  adminPayoutVendor,
  type AdminRevenue,
  type Withdrawal,
} from "@/lib/api";
import {
  invalidateAdminPayments,
  invalidateAdminWithdrawals,
  useAdminPayments,
  useAdminWithdrawals,
  useAdminRevenue,
} from "@/lib/swr-hooks";

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
  const { isAdmin } = useAdminShell();
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

      {/* Vendor withdrawals */}
      <WithdrawalsPanel isAdmin={isAdmin} revenue={revenue} />

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
                    {p.refundStatus === "refunded" ? (
                      <Pill label="Refunded" tone="red" />
                    ) : p.payoutRef ? (
                      <Pill label="Paid out" tone="sky" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[dt(p.paidAt), p.payoutRef || p.gatewayPaymentId].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium ${
                    p.refundStatus === "refunded" ? "text-zinc-500 line-through" : "text-emerald-300"
                  }`}
                >
                  {money(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}

function PayNowBox({ vendors }: { vendors: AdminRevenue["byVendor"] }) {
  const [vendorId, setVendorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const { data: preview, isLoading } = useSWR(
    vendorId ? ["vendor-payout-preview", vendorId] : null,
    () => previewAdminVendorPayout(vendorId),
    { revalidateOnFocus: false },
  );

  const options = vendors.filter((v) => v.vendorId);

  const run = async () => {
    if (!vendorId || busy) return;
    if (!window.confirm(`Pay ${money(preview?.amount ?? 0)} to this vendor now? This transfers the money and locks those payments.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminPayoutVendor(vendorId);
      await Promise.all([invalidateAdminWithdrawals(), invalidateAdminPayments()]);
      setMsg({ kind: "ok", text: "Payout initiated." });
      setVendorId("");
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Could not pay out." });
    } finally {
      setBusy(false);
    }
  };

  const blocked = preview?.activeWithdrawal
    ? "A withdrawal is already in progress for this vendor."
    : preview && !preview.hasPayoutMethod
      ? "Vendor hasn't saved payout details yet."
      : preview && preview.amount <= 0
        ? "No matured funds to pay out."
        : null;

  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <p className="text-xs font-medium text-zinc-300">Pay a vendor now</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Pushes the vendor&apos;s matured balance without waiting for them to request it.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          aria-label="Select vendor"
          className="field-input h-9 w-full py-0 text-sm text-zinc-100 sm:w-72"
        >
          <option value="">Select a vendor…</option>
          {options.map((v) => (
            <option key={v.vendorId as string} value={v.vendorId as string}>
              {v.vendorName}
            </option>
          ))}
        </select>

        {vendorId && (
          <div className="flex items-center gap-3 text-sm">
            {isLoading ? (
              <span className="text-zinc-500">Calculating…</span>
            ) : blocked ? (
              <span className="text-amber-300">{blocked}</span>
            ) : preview ? (
              <span className="text-zinc-300">
                <span className="font-semibold text-emerald-300">{money(preview.amount)}</span> across{" "}
                {preview.count} payment{preview.count === 1 ? "" : "s"}
              </span>
            ) : null}
            {preview && !blocked && (
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="btn-primary shrink-0 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "…" : "Pay now"}
              </button>
            )}
          </div>
        )}
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

const WITHDRAWAL_TONE: Record<Withdrawal["status"], "green" | "sky" | "red" | "amber" | "zinc"> = {
  completed: "green",
  processing: "sky",
  pending: "amber",
  failed: "red",
  rejected: "red",
};

const WITHDRAWAL_LABEL: Record<Withdrawal["status"], string> = {
  pending: "Awaiting approval",
  processing: "Processing",
  completed: "Paid",
  failed: "Failed",
  rejected: "Rejected",
};

function methodSummary(w: Withdrawal) {
  const m = w.payoutMethod;
  if (!m) return "—";
  if (m.type === "vpa") return `UPI · ${m.vpa}`;
  return `${m.accountName ? `${m.accountName} · ` : ""}${m.accountNumberMasked ?? ""}${m.ifsc ? ` · ${m.ifsc}` : ""}`;
}

function WithdrawalsPanel({ isAdmin, revenue }: { isAdmin: boolean; revenue?: AdminRevenue }) {
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const { data, isLoading } = useAdminWithdrawals(
    tab === "pending" ? { status: "pending" } : {},
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const withdrawals = data?.items ?? [];

  const act = async (fn: () => Promise<unknown>, id: string, ok: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      await Promise.all([invalidateAdminWithdrawals(), invalidateAdminPayments()]);
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const approve = (w: Withdrawal) => {
    if (!window.confirm(`Approve ${money(w.amount)} to ${w.vendorName || "vendor"}? This transfers the money and locks those payments.`)) return;
    void act(() => approveAdminWithdrawal(w.id), w.id, "Withdrawal approved — transfer initiated.");
  };
  const reject = (w: Withdrawal) => {
    const reason = window.prompt("Reason for rejecting this withdrawal?") ?? undefined;
    void act(() => rejectAdminWithdrawal(w.id, reason), w.id, "Withdrawal rejected.");
  };
  const refresh = (w: Withdrawal) =>
    void act(() => refreshAdminWithdrawal(w.id), w.id, "Status refreshed.");

  return (
    <div className="mt-4 glass rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Vendor withdrawals</p>
          <p className="mt-1 text-xs text-zinc-500">
            Vendors request payouts of their matured earnings. Approving transfers the money via
            Cashfree Payouts and locks those payments against refunds.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 p-1">
          {(["pending", "all"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === t ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && <PayNowBox vendors={revenue?.byVendor ?? []} />}

      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}

      <div className="mt-4">
        {isLoading && withdrawals.length === 0 ? (
          <LoadingRows />
        ) : withdrawals.length === 0 ? (
          <EmptyState text={tab === "pending" ? "No pending withdrawals." : "No withdrawals yet."} icon="🏦" />
        ) : (
          <ul className="space-y-2">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">
                      {w.vendorName || "Vendor"}
                    </span>
                    <Pill label={WITHDRAWAL_LABEL[w.status]} tone={WITHDRAWAL_TONE[w.status]} />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      {w.withdrawalRef}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {methodSummary(w)} · {dt(w.requestedAt ?? w.createdAt)}
                  </p>
                  {w.failureReason && (
                    <p className="mt-0.5 text-[11px] text-red-300">{w.failureReason}</p>
                  )}
                </div>

                <span className="shrink-0 text-sm font-semibold text-emerald-300">{money(w.amount)}</span>

                {isAdmin && (
                  <div className="flex shrink-0 gap-2">
                    {w.status === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => approve(w)}
                          disabled={busyId === w.id}
                          className="btn-primary rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        >
                          {busyId === w.id ? "…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => reject(w)}
                          disabled={busyId === w.id}
                          className="rounded-full border border-red-400/25 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {w.status === "processing" && (
                      <button
                        type="button"
                        onClick={() => refresh(w)}
                        disabled={busyId === w.id}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                      >
                        {busyId === w.id ? "…" : "Refresh status"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
