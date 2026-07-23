"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  createTicket,
  getTicket,
  listCustomerRefundOptions,
  replyToTicket,
  type NewTicketInput,
  type RefundOption,
  type SupportRole,
  type SupportTicket,
} from "@/lib/api";
import { useMyTickets, invalidateMyTickets } from "@/lib/swr-hooks";

const CATEGORIES: { id: string; label: string }[] = [
  { id: "payment", label: "Payment" },
  { id: "booking", label: "Booking" },
  { id: "order", label: "Print order" },
  { id: "refund", label: "Refund" },
  { id: "account", label: "Account" },
  { id: "other", label: "Other" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  pending: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  resolved: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  closed: "border-white/15 bg-white/5 text-zinc-400",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
        STATUS_STYLES[status] ?? STATUS_STYLES.closed
      }`}
    >
      {status}
    </span>
  );
}

function timeLabel(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function SupportPortal({ role }: { role: SupportRole }) {
  const { data: tickets = [], isLoading, error, mutate } = useMyTickets(role);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const refresh = async () => {
    await Promise.all([mutate(), invalidateMyTickets(role)]);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Support</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Help & support</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Raise a ticket and our team will get back to you here.
          </p>
        </div>
        {!selectedId && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="btn-primary shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
          >
            New ticket
          </button>
        )}
      </div>

      <div className="scroll-pane min-h-0 flex-1 pt-5">
        {selectedId ? (
          <TicketThread
            role={role}
            ticketId={selectedId}
            onBack={() => setSelectedId(null)}
            onUpdated={refresh}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8 text-center text-sm text-red-300">
            Couldn&apos;t load your tickets. Please refresh.
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
            <p className="text-3xl">💬</p>
            <p className="mt-3 text-sm text-zinc-300">No support tickets yet.</p>
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="btn-primary mt-5 rounded-full px-5 py-2 text-sm font-semibold"
            >
              Raise a ticket
            </button>
          </div>
        ) : (
          <ul className="space-y-2 pb-4">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-50">{t.subject}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      {t.ticketRef} · {t.category}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Updated {timeLabel(t.updatedAt)}
                    </p>
                  </div>
                  <StatusPill status={t.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {composerOpen && (
        <NewTicketModal
          role={role}
          onClose={() => setComposerOpen(false)}
          onCreated={async (t) => {
            setComposerOpen(false);
            await refresh();
            setSelectedId(t.id);
          }}
        />
      )}
    </div>
  );
}

function TicketThread({
  role,
  ticketId,
  onBack,
  onUpdated,
}: {
  role: SupportRole;
  ticketId: string;
  onBack: () => void;
  onUpdated: () => Promise<void>;
}) {
  const {
    data: ticket,
    isLoading,
    error: loadError,
    mutate,
  } = useSWR<SupportTicket>(
    ["support-ticket", role, ticketId],
    () => getTicket(role, ticketId),
    { revalidateOnFocus: true },
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const closed = ticket?.status === "closed";

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    try {
      const updated = await replyToTicket(role, ticketId, text);
      await mutate(updated, { revalidate: false });
      setBody("");
      await onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  };

  if (isLoading && !ticket) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/5" />;
  }
  if (!ticket) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/[0.03] p-6 text-sm text-red-300">
        {loadError instanceof Error ? loadError.message : "Could not load this ticket."}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          ← All tickets
        </button>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">{ticket.subject}</h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
              {ticket.ticketRef} · {ticket.category}
            </p>
          </div>
          <StatusPill status={ticket.status} />
        </div>
      </div>

      <div className="scroll-pane mt-4 min-h-0 flex-1 space-y-3">
        {ticket.messages.map((m, i) => {
          const mine = m.authorRole === "user";
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine
                    ? "bg-white/10 text-zinc-100"
                    : "border border-white/8 bg-white/[0.03] text-zinc-200"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {m.authorRole === "admin" ? m.authorName || "Support" : "You"} ·{" "}
                  {timeLabel(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 shrink-0">
        {err && <p className="mb-2 text-xs text-red-300">{err}</p>}
        {closed ? (
          <p className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-center text-xs text-zinc-500">
            This ticket is closed. Raise a new ticket if you still need help.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="Write a reply…"
              className="field-input flex-1 resize-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !body.trim()}
              className="btn-primary shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewTicketModal({
  role,
  onClose,
  onCreated,
}: {
  role: SupportRole;
  onClose: () => void;
  onCreated: (ticket: SupportTicket) => void;
}) {
  const [form, setForm] = useState<NewTicketInput>({ subject: "", category: "other", message: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const refundMode = role === "customer" && form.category === "refund";
  const { data: refundOptions = [], isLoading: loadingRefundOptions } = useSWR<RefundOption[]>(
    refundMode ? "customer-refund-options" : null,
    listCustomerRefundOptions,
    { revalidateOnFocus: true },
  );

  const submit = async () => {
    if (saving) return;
    if (!form.subject.trim() || !form.message.trim()) {
      setErr("Please add a subject and describe your issue.");
      return;
    }
    if (refundMode && !form.relatedId) {
      setErr("Select the order or booking you want refunded.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const ticket = await createTicket(role, {
        subject: form.subject.trim(),
        category: form.category,
        message: form.message.trim(),
        relatedType: refundMode ? "payment" : undefined,
        relatedId: refundMode ? form.relatedId : undefined,
      });
      onCreated(ticket);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel !min-h-0 max-w-lg p-6">
        <h2 className="text-lg font-semibold text-zinc-50">New support ticket</h2>
        <p className="mt-1 text-sm text-zinc-400">Tell us what&apos;s going on.</p>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Short summary"
              className="field-input"
              maxLength={160}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value,
                  relatedType: undefined,
                  relatedId: undefined,
                }))
              }
              className="field-input"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {refundMode && (
            <RefundOrderPicker
              options={refundOptions}
              loading={loadingRefundOptions}
              selectedRef={form.relatedId}
              onSelect={(refId) =>
                setForm((f) => ({ ...f, relatedType: "payment", relatedId: refId }))
              }
            />
          )}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={4}
              placeholder="Describe your issue in detail…"
              className="field-input resize-none"
            />
          </div>
          {err && <p className="text-xs text-red-300">{err}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

const REFUND_SOURCE_LABEL: Record<string, string> = {
  booking: "Booking",
  event: "Event registration",
  print: "Print order",
};

function refundOptionStatus(option: RefundOption) {
  if (option.status === "refunded") return "Already refunded";
  if (option.paidOut) return "Already paid to vendor";
  if (option.matured) return "7-day window expired";
  return option.refundable ? "Eligible for refund" : "Not refundable";
}

function RefundOrderPicker({
  options,
  loading,
  selectedRef,
  onSelect,
}: {
  options: RefundOption[];
  loading: boolean;
  selectedRef?: string;
  onSelect: (refId: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-400">
        Select the order or booking to refund
      </label>
      <div className="scroll-pane max-h-48 space-y-1.5 rounded-xl border border-white/8 bg-black/10 p-2">
        {loading ? (
          <p className="p-3 text-xs text-zinc-500">Loading your payments…</p>
        ) : options.length === 0 ? (
          <p className="p-3 text-xs text-zinc-500">You have no paid orders or bookings.</p>
        ) : (
          options.map((option) => {
            const eligible = option.refundable;
            const selected = selectedRef === option.refId;
            return (
              <button
                key={option.id}
                type="button"
                disabled={!eligible}
                onClick={() => onSelect(option.refId)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  selected
                    ? "border-emerald-400/40 bg-emerald-400/10"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {REFUND_SOURCE_LABEL[option.source] ?? "Order"}
                    {option.sourceRef ? ` · ${option.sourceRef}` : ""}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                    {option.refId} · {timeLabel(option.paidAt)}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] ${
                      eligible ? "text-emerald-300" : "text-zinc-500"
                    }`}
                  >
                    {refundOptionStatus(option)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-zinc-100">
                  ₹{option.amount.toLocaleString("en-IN")}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
