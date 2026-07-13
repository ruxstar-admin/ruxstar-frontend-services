"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useVendorShell } from "@/components/vendor-shell";
import {
  setPrintAcceptingOrders,
  updatePrintOrderStatus,
  type Business,
  type PrintOrder,
  type PrintOrderStatus,
} from "@/lib/api";
import {
  invalidateVendorPrintOrders,
  useVendorBusinesses,
  useVendorPrintOrders,
} from "@/lib/swr-hooks";
import { formatPrintOrderAttributes } from "@/lib/print-requirements";

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

export default function VendorPrintOrdersPage() {
  const { kycVerified, kyc } = useVendorShell();
  const { data, isLoading } = useVendorPrintOrders(kycVerified);
  const [error, setError] = useState("");

  const assigned = useMemo(() => data?.assigned ?? [], [data]);
  const hasPrintBusiness = data?.eligible.hasPrintBusiness ?? false;

  const stats = useMemo(() => {
    const awaiting = assigned.filter((o) =>
      ["accepted", "pending_payment"].includes(o.status),
    ).length;
    const active = assigned.filter((o) =>
      ["confirmed", "in_production", "ready"].includes(o.status),
    ).length;
    const completed = assigned.filter((o) => o.status === "completed").length;
    return { total: assigned.length, awaiting, active, completed };
  }, [assigned]);

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Ruxstar Card required</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Verify your identity to receive print orders.
            {kyc?.status === "pending_review" && " Your card is under review."}
          </p>
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

  const list = assigned;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Print on demand</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              <span className="text-gradient">Orders</span>
            </h1>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="All orders" value={stats.total} accent="sky" />
          <StatCard label="Awaiting payment" value={stats.awaiting} accent="amber" />
          <StatCard label="In progress" value={stats.active} accent="emerald" />
          <StatCard label="Completed" value={stats.completed} accent="zinc" />
        </div>

        <ShopAvailabilityBar enabled={kycVerified} />

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}

        {!hasPrintBusiness && !isLoading && (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            Set up a live <strong>Print on demand</strong> business to start receiving orders.{" "}
            <Link href="/business/businesses" className="underline">
              Onboard now →
            </Link>
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div className="scroll-pane mt-6 min-h-0 flex-1">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState text="No orders yet. Customers who order from your shop will appear here." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assigned.map((order) => (
              <AssignedOrderCard key={order.id} order={order} onError={setError} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopAvailabilityBar({ enabled }: { enabled: boolean }) {
  const { data: businesses = [], mutate } = useVendorBusinesses(enabled);
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const printShops = businesses.filter((b) => b.module === "print");
  if (printShops.length === 0) return null;

  const isAccepting = (shop: Business) =>
    override[shop.id] ?? (shop.setup?.printProfile?.acceptingOrders ?? true);

  async function toggle(shop: Business) {
    const next = !isAccepting(shop);
    setOverride((o) => ({ ...o, [shop.id]: next }));
    setBusyId(shop.id);
    try {
      await setPrintAcceptingOrders(shop.id, next);
      await mutate();
    } catch {
      setOverride((o) => ({ ...o, [shop.id]: !next }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Your shops
      </span>
      {printShops.map((shop) => {
        const accepting = isAccepting(shop);
        return (
          <button
            key={shop.id}
            type="button"
            disabled={busyId === shop.id}
            onClick={() => void toggle(shop)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
              accepting
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                : "border-zinc-500/30 bg-white/[0.03] text-zinc-400 hover:bg-white/5"
            }`}
            title={accepting ? "Tap to stop accepting orders" : "Tap to start accepting orders"}
          >
            <span
              className={`h-2 w-2 rounded-full ${accepting ? "bg-emerald-400" : "bg-zinc-500"}`}
            />
            <span className="max-w-[10rem] truncate">{shop.name}</span>
            <span className="text-[10px] uppercase tracking-wide">
              {busyId === shop.id ? "…" : accepting ? "Open" : "Closed"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  sky: "text-sky-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  zinc: "text-zinc-200",
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: keyof typeof ACCENTS | string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className={`text-2xl font-semibold ${ACCENTS[accent] ?? "text-zinc-200"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-14 text-center">
      <p className="text-3xl">🖨️</p>
      <p className="mt-3 max-w-sm text-sm text-zinc-400">{text}</p>
    </div>
  );
}

function OrderCardShell({
  href,
  children,
  footer,
}: {
  href: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition hover:border-white/12 hover:bg-white/[0.04]">
      <Link href={href} className="flex flex-1 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg">
          🖨️
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </Link>
      {footer && <div className="mt-3 border-t border-white/8 pt-3">{footer}</div>}
    </article>
  );
}

function AssignedOrderCard({
  order,
  onError,
}: {
  order: PrintOrder;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = NEXT_STATUS[order.status];
  const href = `/business/print-orders/${order.id}`;
  const attrs = formatPrintOrderAttributes(order.attributes);

  async function advance() {
    if (!next) return;
    setBusy(true);
    onError("");
    try {
      await updatePrintOrderStatus(order.id, next.status);
      await invalidateVendorPrintOrders();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OrderCardShell
      href={href}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-emerald-300">{money(order.quoteAmount)}</span>
          {next ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void advance()}
              className="btn-primary shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60 sm:text-sm"
            >
              {busy ? "…" : next.label}
            </button>
          ) : (
            <span className="text-xs text-zinc-500">{STATUS_LABELS[order.status]}</span>
          )}
        </div>
      }
    >
      <div className="flex items-center gap-2">
        <p className="truncate font-medium text-zinc-100">
          {order.quantity} × {order.categoryLabel}
        </p>
        <span className="shrink-0 rounded-md border border-white/8 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
        {[attrs, order.city].filter(Boolean).join(" · ")}
      </p>
      {order.status === "accepted" && (
        <p className="mt-1.5 text-xs text-amber-300/80">Awaiting customer payment</p>
      )}
    </OrderCardShell>
  );
}
