"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import useSWR from "swr";
import { useVendorShell } from "@/components/vendor-shell";
import {
  submitPrintQuote,
  getVendorPrintOrder,
  updatePrintOrderStatus,
  type PrintOrder,
  type PrintOrderStatus,
} from "@/lib/api";
import { invalidateVendorPrintOrders, podPollOpts } from "@/lib/swr-hooks";
import { orderAttributeRows } from "@/lib/print-requirements";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  accepted: "Awaiting payment",
  pending_payment: "Payment started",
  confirmed: "Paid",
  in_production: "In production",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const NEXT_STATUS: Partial<Record<string, { status: PrintOrderStatus; label: string }>> = {
  confirmed: { status: "in_production", label: "Start production" },
  in_production: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Mark completed" },
};

export default function VendorPrintOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const { kycVerified } = useVendorShell();
  const { data, error, isLoading, mutate } = useSWR<PrintOrder>(
    kycVerified && orderId ? ["vendor-print-order", orderId] : null,
    () => getVendorPrintOrder(orderId),
    podPollOpts(8_000),
  );

  const [quote, setQuote] = useState("");
  const [note, setNote] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (prefilled || !data?.myQuote) return;
    if (data.myQuote.quoteAmount != null) setQuote(String(data.myQuote.quoteAmount));
    if (data.myQuote.vendorNote) setNote(data.myQuote.vendorNote);
    setPrefilled(true);
  }, [data, prefilled]);

  async function onQuote() {
    if (!data) return;
    const amount = Math.round(Number(quote));
    if (!Number.isFinite(amount) || amount < 1) {
      setActionError("Enter a valid quote amount.");
      return;
    }
    setBusy(true);
    setActionError("");
    const optimistic: PrintOrder = {
      ...data,
      myQuote: {
        quoteAmount: amount,
        vendorNote: note.trim(),
        createdAt: data.myQuote?.createdAt ?? new Date().toISOString(),
      },
    };
    try {
      await mutate(
        async () => {
          await submitPrintQuote(data.id, { quoteAmount: amount, vendorNote: note.trim() });
          return getVendorPrintOrder(data.id);
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: true },
      );
      invalidateVendorPrintOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not submit quote.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdvance(next: PrintOrderStatus) {
    if (!data) return;
    setBusy(true);
    setActionError("");
    const optimistic: PrintOrder = { ...data, status: next };
    try {
      await mutate(
        async () => {
          await updatePrintOrderStatus(data.id, next);
          return getVendorPrintOrder(data.id);
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: true },
      );
      invalidateVendorPrintOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      setBusy(false);
    }
  }

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <Link
            href="/business/kyc"
            className="btn-primary mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            Get your Ruxstar Card
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <BackLink />
        <div className="mt-4 h-56 flex-1 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <BackLink />
        <div className="mt-4 flex flex-1 items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
            <p className="text-3xl">🔍</p>
            <p className="mt-3 text-sm text-zinc-400">This order is no longer available.</p>
            <Link
              href="/business/print-orders"
              className="btn-primary mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              Back to orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const order = data;
  const next = NEXT_STATUS[order.status];
  const showCustomer =
    order.status === "confirmed" ||
    order.status === "in_production" ||
    order.status === "ready" ||
    order.status === "completed";
  const design = order.designImage || order.designImageUrl || "";
  const specRows = orderAttributeRows(order.attributes);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Fixed header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <BackLink />
          <StatusPill status={order.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
            {order.quantity} × {order.categoryLabel}
          </h1>
          <p className="text-sm capitalize text-zinc-500">
            📍 {order.city}
            {order.pincode ? ` · ${order.pincode}` : ""}
          </p>
        </div>

        {actionError && (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {actionError}
          </p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="scroll-pane mt-5 min-h-0 flex-1">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          {/* Design (large) */}
          <div className="glass rounded-2xl p-4 sm:p-5">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Customer design
            </p>
            {design ? (
              <div className="flex min-h-[20rem] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30 lg:min-h-[26rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={design}
                  alt="Design"
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
            ) : order.hasDesign ? (
              <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-zinc-600 lg:min-h-[26rem]">
                Loading design…
              </div>
            ) : (
              <div className="flex min-h-[20rem] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-xs text-zinc-600 lg:min-h-[26rem]">
                No design attached
              </div>
            )}

            {order.notes && (
              <p className="mt-4 border-l-2 border-white/15 pl-3 text-sm italic text-zinc-400">
                “{order.notes}”
              </p>
            )}
          </div>

          {/* Specs + actions */}
          <div className="space-y-4">
            {specRows.length > 0 && <OrderSpecsPanel rows={specRows} />}

            {order.status === "open" && (
              <div className="glass rounded-2xl p-4 sm:p-5">
                {order.myQuote ? (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/40 bg-emerald-400/20 text-lg">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-100">Quote submitted</p>
                        <p className="text-xs text-emerald-200/70">Waiting for customer to choose</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
                      <span className="text-xs text-zinc-400">Your quote</span>
                      <span className="text-lg font-semibold text-emerald-300">
                        {money(order.myQuote.quoteAmount)}
                      </span>
                    </div>
                    {order.myQuote.vendorNote && (
                      <p className="mt-2 text-xs text-zinc-500">“{order.myQuote.vendorNote}”</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-zinc-100">Submit your quote</p>
                )}
                <label className="mt-4 block">
                  <span className="text-xs text-zinc-500">Quote amount (₹)</span>
                  <input
                    type="number"
                    min={1}
                    value={quote}
                    onChange={(e) => setQuote(e.target.value)}
                    placeholder="e.g. 1200"
                    className="field-input mt-1 py-2 text-sm"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-xs text-zinc-500">Note to customer (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. 3 day delivery, includes design"
                    className="field-input mt-1 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onQuote}
                  className="btn-primary mt-4 w-full rounded-full py-2.5 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                >
                  {busy
                    ? "Saving…"
                    : order.myQuote
                      ? "Update quote"
                      : "Submit quote"}
                </button>
              </div>
            )}

            {order.status !== "open" && (
              <div className="glass rounded-2xl p-4 sm:p-5">
                <p className="text-xs text-zinc-500">Your quote</p>
                <p className="mt-0.5 text-2xl font-semibold text-zinc-100">
                  {money(order.quoteAmount)}
                </p>
                {order.vendorNote && (
                  <p className="mt-2 text-xs text-zinc-500">“{order.vendorNote}”</p>
                )}
                {order.status === "accepted" && (
                  <p className="mt-2 text-xs text-amber-300/80">Waiting for customer payment</p>
                )}
                {next && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAdvance(next.status)}
                    className="btn-primary mt-4 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? "Saving…" : next.label}
                  </button>
                )}
              </div>
            )}

            {showCustomer && (
              <div className="glass rounded-2xl p-4 sm:p-5">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Customer</p>
                <p className="mt-1 text-sm font-medium text-zinc-100">
                  {order.customerName || "Customer"}
                </p>
                {order.customerMobile && (
                  <a
                    href={`tel:+91${order.customerMobile}`}
                    className="mt-3 inline-block rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    📞 +91 {order.customerMobile}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderSpecsPanel({
  rows,
  className = "",
}: {
  rows: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/12 bg-white/[0.05] p-3 sm:p-4 ${className}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Order specifications
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls =
    status === "open"
      ? "border-sky-400/25 bg-sky-400/10 text-sky-300"
      : status === "accepted" || status === "pending_payment"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
        : status === "confirmed" || status === "in_production" || status === "ready"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-zinc-400";
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function BackLink() {
  return (
    <Link
      href="/business/print-orders"
      className="inline-block text-sm text-zinc-500 transition hover:text-zinc-300"
    >
      ← Orders
    </Link>
  );
}
