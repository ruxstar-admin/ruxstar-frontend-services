"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  cancelCommerceOrder,
  getMyCommerceOrder,
  payCommerceOrder,
  type CommerceOrder,
} from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { CustomerBackLink } from "@/components/customer-shell";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STEPS = ["pending_payment", "confirmed", "preparing", "ready", "completed"] as const;

export default function CustomerCommerceOrderPage() {
  const params = useParams();
  const id = String(params.orderId || "");
  const [order, setOrder] = useState<CommerceOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setOrder(await getMyCommerceOrder(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found");
    }
  }

  useEffect(() => {
    if (id) void refresh();
  }, [id]);

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const { payment } = await payCommerceOrder(id);
      await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment");
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      setOrder(await cancelCommerceOrder(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  if (!order && !error) {
    return <p className="p-6 text-sm text-zinc-500">Loading order…</p>;
  }

  if (!order) {
    return (
      <div className="p-6">
        <CustomerBackLink href="/customer/orders" label="← My orders" />
        <p className="mt-4 text-sm text-red-200">{error}</p>
      </div>
    );
  }

  const stepIdx = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const canPay = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <CustomerBackLink href="/customer/orders" label="← My orders" />
      <h1 className="mt-4 text-2xl font-semibold text-zinc-100">{order.businessName}</h1>
      <p className="mt-1 text-sm text-zinc-500">Commerce order · pickup after payment</p>

      {error && (
        <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
              stepIdx >= i
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-zinc-600"
            }`}
          >
            {s.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <ul className="mt-6 space-y-2">
        {order.items.map((item) => (
          <li
            key={item.productId}
            className="flex justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-sm"
          >
            <span className="text-zinc-200">
              {item.quantity}× {item.name}
            </span>
            <span className="text-zinc-400">{money(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-lg font-semibold text-emerald-300">{money(order.amount)}</p>

      {order.paymentStatus === "paid" && order.vendorMobile && (
        <p className="mt-3 text-sm text-zinc-400">
          Shop contact: <span className="text-zinc-200">{order.vendorMobile}</span>
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {canPay && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void pay()}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Opening…" : "Pay now"}
          </button>
        )}
        {canPay && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-300 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <Link
          href="/customer/commerce"
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-300"
        >
          Browse shops
        </Link>
      </div>
    </div>
  );
}
