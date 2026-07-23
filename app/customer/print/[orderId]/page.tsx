"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import useSWR from "swr";
import {
  cancelPrintOrder,
  getPrintOrder,
  payPrintOrder,
  type PrintOrder,
} from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { invalidateMyPrintOrders, podPollOpts } from "@/lib/swr-hooks";
import { formatPrintOrderAttributes } from "@/lib/print-requirements";
import { PrintProgress } from "@/components/print-progress";

const money = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—";

const PAGE_HEADER =
  "shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const PAGE_FOOTER =
  "shrink-0 border-t border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const SCROLL_BODY = "scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8";

const STEP_INDEX: Record<string, number> = {
  open: 0,
  accepted: 1,
  pending_payment: 1,
  confirmed: 2,
  in_production: 3,
  ready: 4,
  completed: 5,
};

export default function CustomerPrintOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<PrintOrder>(
    orderId ? ["print-order", orderId] : null,
    () => getPrintOrder(orderId),
    podPollOpts(8_000),
  );

  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState("");
  const [cancelNotice, setCancelNotice] = useState("");

  async function onPay() {
    if (!data) return;
    setPaying(true);
    setActionError("");
    try {
      const { payment } = await payPrintOrder(data.id);
      await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start payment.");
      setPaying(false);
    }
  }

  async function onCancel() {
    if (!data) return;
    if (!window.confirm("Cancel this print order?")) return;
    setCancelling(true);
    setActionError("");
    try {
      const refund = await cancelPrintOrder(data.id);
      await Promise.all([mutate(), invalidateMyPrintOrders()]);
      if (refund.reason === "via_support") {
        setCancelNotice(
          "Order cancelled. To request a refund, raise a support ticket — refunds are available within 7 days of payment.",
        );
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not cancel order.");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <section className="flex h-full min-h-0 flex-col bg-[#0a0a0b]/40">
        <div className={PAGE_HEADER}>
          <Link href="/customer/orders" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← My orders
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="h-48 w-full max-w-xl animate-pulse rounded-2xl bg-white/5" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="flex h-full min-h-0 flex-col bg-[#0a0a0b]/40">
        <div className={PAGE_HEADER}>
          <Link href="/customer/orders" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← My orders
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 text-sm text-zinc-400">We couldn&apos;t find this order.</p>
            <button
              type="button"
              onClick={() => router.push("/customer/orders")}
              className="btn-primary mt-5 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              Back to orders
            </button>
          </div>
        </div>
      </section>
    );
  }

  const order = data;
  const step = STEP_INDEX[order.status] ?? 0;
  const isCancelled = order.status === "cancelled" || order.status === "expired";
  const canCancel = order.status === "accepted" || order.status === "pending_payment";
  const vendorRevealed = step >= 1 && !isCancelled;
  const contactRevealed = step >= 2;
  const attrs = formatPrintOrderAttributes(order.attributes);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#0a0a0b]/40">
      <div className={PAGE_HEADER}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/customer/orders" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← My orders
          </Link>
          {canCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={onCancel}
              className="shrink-0 rounded-full border border-red-400/35 bg-red-400/10 px-4 py-1.5 text-xs font-medium text-red-300 transition hover:border-red-400/50 hover:bg-red-400/15 disabled:opacity-50 sm:px-5 sm:py-2 sm:text-sm"
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          )}
        </div>

        {actionError && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {actionError}
          </p>
        )}

        {cancelNotice && (
          <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {cancelNotice}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(200px,280px)] sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
              {order.quantity} × {order.categoryLabel}
            </h1>
            {attrs && <p className="mt-1 text-sm text-zinc-400">{attrs}</p>}
            <p className="mt-1 text-sm capitalize text-zinc-500">📍 {order.city}</p>
          </div>

          {(order.notes || order.quoteAmount != null) && (
            <div className="flex flex-col gap-3 sm:border-l sm:border-white/8 sm:pl-6">
              {order.notes && (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Notes
                  </p>
                  <p className="mt-1.5 text-left text-sm leading-relaxed text-zinc-400">
                    “{order.notes}”
                  </p>
                </div>
              )}
              {order.quoteAmount != null && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Total
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-300">
                    {money(order.quoteAmount)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={SCROLL_BODY}>
        <PrintProgress status={order.status} role="customer" size="sm" className="mb-6" />

        {(order.status === "accepted" ||
          contactRevealed ||
          order.designImageUrl) && (
          <div className="grid gap-4 lg:grid-cols-2">
            {order.status === "accepted" && (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/35 bg-emerald-400/15 text-lg">
                    ✓
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-emerald-100">Order placed</p>
                    {vendorRevealed && (order.businessName || order.vendorName) && (
                      <p className="truncate text-sm text-zinc-300">
                        {order.businessName || order.vendorName}
                      </p>
                    )}
                  </div>
                </div>
                {order.vendorNote && (
                  <p className="mt-3 border-l-2 border-emerald-400/25 pl-3 text-sm italic text-zinc-400">
                    “{order.vendorNote}”
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3">
                  <span className="text-xs text-zinc-400">Amount to pay</span>
                  <span className="text-lg font-semibold text-emerald-300">
                    {money(order.quoteAmount)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Contact details unlock right after payment.
                </p>
              </div>
            )}

            {contactRevealed && (order.businessName || order.vendorName) && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Your vendor
                </p>
                <p className="mt-2 text-lg font-medium text-zinc-100">
                  {order.businessName || order.vendorName}
                </p>
                {order.businessName && order.vendorName && (
                  <p className="text-sm text-zinc-500">{order.vendorName}</p>
                )}
                {order.vendorMobile && (
                  <a
                    href={`tel:+91${order.vendorMobile}`}
                    className="mt-4 inline-block rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    📞 +91 {order.vendorMobile}
                  </a>
                )}
              </div>
            )}

            {order.designImageUrl && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Your design
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.designImageUrl}
                  alt="Design"
                  className="mt-3 max-h-64 w-full rounded-xl border border-white/10 object-contain"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {order.status === "accepted" && (
        <div className={PAGE_FOOTER}>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={paying}
              onClick={onPay}
              className="btn-primary rounded-full px-10 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {paying ? "Starting…" : `Pay ${money(order.quoteAmount)}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
