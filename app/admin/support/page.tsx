"use client";

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
import {
  getAdminTicket,
  getAdminUserActivity,
  issueAdminRefund,
  replyAdminTicket,
  setAdminTicketStatus,
  type AdminPayment,
  type SupportTicket,
} from "@/lib/api";
import { invalidateAdminTickets, useAdminTickets } from "@/lib/swr-hooks";

const STATUS_TONE: Record<string, "green" | "amber" | "sky" | "zinc"> = {
  open: "green",
  pending: "amber",
  resolved: "sky",
  closed: "zinc",
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

export default function AdminSupportPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      role: role || undefined,
      page,
      limit: 20,
    }),
    [debouncedSearch, status, role, page],
  );
  const { data, isLoading } = useAdminTickets(params);
  const tickets = data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Support" subtitle="Customer and vendor support tickets." total={data?.total} />

      <Toolbar>
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search ticket ref, subject, name…"
        />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "Any status" },
            { value: "open", label: "Open" },
            { value: "pending", label: "Pending" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
          ]}
        />
        <Select
          ariaLabel="Raised by"
          value={role}
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "Anyone" },
            { value: "customer", label: "Customers" },
            { value: "vendor", label: "Vendors" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && tickets.length === 0 ? (
          <LoadingRows />
        ) : tickets.length === 0 ? (
          <EmptyState text="No tickets match these filters." icon="💬" />
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-zinc-50">{t.subject}</span>
                      <Pill label={t.status} tone={STATUS_TONE[t.status] ?? "zinc"} />
                      <Pill label={t.raisedByRole} tone="zinc" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {[t.raisedByName || "User", t.category, `updated ${dt(t.updatedAt)}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                      {t.ticketRef}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">Open →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>

      {openId && (
        <TicketDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => invalidateAdminTickets()}
        />
      )}
    </div>
  );
}

function TicketDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: ticket, isLoading: loading, mutate } = useSWR<SupportTicket>(
    ["admin-ticket", id],
    () => getAdminTicket(id),
    { revalidateOnFocus: false },
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reply = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await replyAdminTicket(id, text);
      await mutate(updated, { revalidate: false });
      setBody("");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send reply.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: string) => {
    setBusy(true);
    setErr(null);
    try {
      const updated = await setAdminTicketStatus(id, status);
      await mutate(updated, { revalidate: false });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel flex max-w-2xl flex-col p-6">
        {loading || !ticket ? (
          <p className="py-10 text-center text-sm text-zinc-500">Loading ticket…</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-50">{ticket.subject}</h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                  {ticket.ticketRef} · {ticket.category} · {ticket.raisedByRole}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">{ticket.raisedByName || "User"}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {["open", "pending", "resolved", "closed"].map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || ticket.status === s}
                  onClick={() => changeStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs capitalize transition disabled:opacity-40 ${
                    ticket.status === s
                      ? "bg-white/10 text-zinc-100"
                      : "border border-white/10 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <RefundBox
              ticketId={id}
              customerUserId={ticket.raisedByUserId}
              selectedPaymentRef={
                ticket.relatedType === "payment" ? ticket.relatedId : null
              }
              highlight={ticket.category === "refund"}
              onRefunded={async () => {
                await mutate();
                onChanged();
              }}
            />

            <div className="scroll-pane mt-4 max-h-[46vh] min-h-[8rem] flex-1 space-y-3">
              {ticket.messages.map((m, i) => {
                const admin = m.authorRole === "admin";
                return (
                  <div key={i} className={`flex ${admin ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        admin
                          ? "bg-white/10 text-zinc-100"
                          : "border border-white/8 bg-white/[0.03] text-zinc-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {admin ? m.authorName || "Support" : ticket.raisedByName || "User"} ·{" "}
                        {dt(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
            <div className="mt-3 flex items-end gap-2 border-t border-white/5 pt-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="Reply to the user…"
                className="field-input flex-1 resize-none"
              />
              <button
                type="button"
                onClick={reply}
                disabled={busy || !body.trim()}
                className="btn-primary shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  booking: "Slot booking",
  event: "Event",
  print: "Print order",
};

// The refund eligibility of a single payment, for the support agent's view.
function refundEligibility(p: AdminPayment): {
  can: boolean;
  label: string;
  tone: "green" | "sky" | "red" | "zinc";
} {
  if (p.status === "refunded" || p.refundStatus === "refunded")
    return { can: false, label: "Refunded", tone: "red" };
  if (p.payoutRef || p.withdrawalStatus)
    return { can: false, label: "Paid out — locked", tone: "sky" };
  if (p.refundable) return { can: true, label: "Refundable", tone: "green" };
  if (p.matured) return { can: false, label: "Refund window expired", tone: "zinc" };
  return { can: false, label: "Not refundable", tone: "zinc" };
}

function RefundBox({
  ticketId,
  customerUserId,
  selectedPaymentRef,
  highlight,
  onRefunded,
}: {
  ticketId: string;
  customerUserId: string | null;
  selectedPaymentRef: string | null;
  highlight: boolean;
  onRefunded: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(highlight);
  const { data, isLoading, mutate: refetch } = useSWR(
    open && customerUserId ? ["ticket-activity", customerUserId] : null,
    () => getAdminUserActivity(customerUserId as string),
    { revalidateOnFocus: false },
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const payments = (data?.payments ?? [])
    .filter((p) => p.refId)
    .sort((a, b) => {
      if (a.refId === selectedPaymentRef) return -1;
      if (b.refId === selectedPaymentRef) return 1;
      return new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime();
    });

  const refund = async (p: AdminPayment) => {
    if (!p.refId || busyId) return;
    if (!window.confirm(`Refund ₹${p.amount.toLocaleString("en-IN")} for ${p.refId}? This cannot be undone.`)) return;
    setBusyId(p.id);
    setMsg(null);
    try {
      const res = await issueAdminRefund(p.refId);
      // Log the refund into the ticket thread for an audit trail.
      await replyAdminTicket(
        ticketId,
        `Refund of ₹${(res.amount ?? p.amount).toLocaleString("en-IN")} issued for ${p.refId}.`,
      ).catch(() => undefined);
      await setAdminTicketStatus(ticketId, "resolved").catch(() => undefined);
      setMsg({ kind: "ok", text: `Refunded ₹${(res.amount ?? p.amount).toLocaleString("en-IN")}.` });
      await Promise.all([refetch(), onRefunded()]);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Could not issue refund." });
    } finally {
      setBusyId(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 self-start rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5"
      >
        Issue a refund
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.03] p-3">
      <p className="text-xs font-medium text-amber-200">Issue a refund</p>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Refunds are allowed within 7 days of payment and before the vendor has withdrawn the funds.
      </p>

      {msg && (
        <p className={`mt-2 text-xs ${msg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-2 space-y-1.5">
        {!customerUserId ? (
          <p className="text-xs text-zinc-500">No customer linked to this ticket.</p>
        ) : isLoading ? (
          <p className="text-xs text-zinc-500">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-zinc-500">This customer has no payments on record.</p>
        ) : (
          payments.map((p) => {
            const elig = refundEligibility(p);
            const selected = p.refId === selectedPaymentRef;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  selected
                    ? "border-amber-400/30 bg-amber-400/[0.06]"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm text-zinc-200">
                      {SOURCE_LABELS[p.source] ?? p.source}
                    </span>
                    {selected && <Pill label="Customer selected" tone="amber" />}
                    <Pill label={elig.label} tone={elig.tone} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                    {p.refId} · {dt(p.paidAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-zinc-100">
                  ₹{p.amount.toLocaleString("en-IN")}
                </span>
                {elig.can && (
                  <button
                    type="button"
                    onClick={() => refund(p)}
                    disabled={busyId === p.id}
                    className="btn-primary shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {busyId === p.id ? "…" : "Refund"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
