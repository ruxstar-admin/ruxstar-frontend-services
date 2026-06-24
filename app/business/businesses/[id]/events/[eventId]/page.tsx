"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { useVendorShell } from "@/components/vendor-shell";
import { VendorEventWizard } from "@/components/vendor-event-wizard";
import { invalidateVendorEvents } from "@/lib/swr-hooks";
import {
  deleteVendorEvent,
  getVendorEvent,
  setVendorEventStatus,
  type EventRegistration,
} from "@/lib/api";

function formatWhen(iso: string | null) {
  if (!iso) return "Date TBD";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export default function ManageBusinessEventPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = typeof params.id === "string" ? params.id : "";
  const eventId = typeof params.eventId === "string" ? params.eventId : "";
  const { kycVerified } = useVendorShell();

  const { data, isLoading, mutate } = useSWR(
    kycVerified ? `vendor/events/${eventId}` : null,
    () => getVendorEvent(eventId),
    { revalidateOnFocus: true },
  );

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!kycVerified) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass rounded-2xl p-10">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold">Complete KYC first</h1>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    );
  }

  const { event, registrations } = data;
  const isTeam = event.format === "team";

  async function doStatus(action: "publish" | "unpublish" | "cancel") {
    setError("");
    setBusy(true);
    try {
      await setVendorEventStatus(eventId, action);
      await mutate();
      await invalidateVendorEvents();
      if (action === "publish") {
        requestAnimationFrame(() => {
          document.getElementById("registrations")?.scrollIntoView({ behavior: "smooth" });
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!window.confirm("Delete this event? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteVendorEvent(eventId);
      await invalidateVendorEvents();
      router.push("/business/businesses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back
          </button>
          <p className="mt-2 text-sm text-zinc-500">Edit event</p>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <VendorEventWizard
            mode="edit"
            businessId={businessId}
            businessName={event.businessName}
            eventKind={event.kind}
            initial={event}
            onDone={async () => {
              await mutate();
              await invalidateVendorEvents();
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Fixed header: title, status and actions stay visible while the body scrolls */}
      <div className="mx-auto w-full max-w-3xl shrink-0 border-b border-white/5 pb-4">
        <Link href="/business/businesses" className="inline-block text-sm text-zinc-500 transition hover:text-zinc-300">
          ← My businesses
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{event.kind === "tournament" ? "🏆" : "🎫"}</span>
              <h1 className="truncate text-2xl font-semibold">{event.title}</h1>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {event.tournamentType ? `${event.tournamentType} · ` : ""}
              {formatWhen(event.startAt)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              event.status === "published"
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                : event.status === "cancelled"
                  ? "border-red-400/25 bg-red-400/10 text-red-300"
                  : "border-zinc-500/25 bg-zinc-500/10 text-zinc-300"
            }`}
          >
            {event.status}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {event.status !== "published" && event.status !== "cancelled" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doStatus("publish")}
              className="btn-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Publish
            </button>
          )}
          {event.status === "published" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doStatus("unpublish")}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
          >
            Edit
          </button>
          {event.status !== "cancelled" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doStatus("cancel")}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Cancel event
            </button>
          )}
          {event.confirmedCount === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={doDelete}
              className="rounded-full border border-white/10 px-5 py-2 text-sm text-zinc-500 hover:bg-white/5 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl pb-12">
          <details className="group mt-5 glass rounded-2xl p-5 text-sm text-zinc-400">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-zinc-200 marker:content-['']">
              Event details
              <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <Detail
                label="Format"
                value={
                  event.kind === "tournament"
                    ? isTeam
                      ? `Team of ${event.teamSize ?? "?"}`
                      : "Individual"
                    : "Event"
                }
              />
              {event.venue && <Detail label="Venue" value={event.venue} />}
              {event.registrationDeadline && (
                <Detail label="Registration closes" value={formatWhen(event.registrationDeadline)} />
              )}
              {(event.skillLevel || event.ageCategory || event.genderCategory) && (
                <Detail
                  label="Categories"
                  value={[event.skillLevel, event.ageCategory, event.genderCategory].filter(Boolean).join(" · ")}
                />
              )}
              {event.rules && <Detail label="Rules" value={event.rules} />}
              {event.description && <Detail label="About" value={event.description} />}
            </div>
          </details>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Registered" value={String(event.confirmedCount)} />
            <Stat
              label={event.capacity != null ? "Capacity" : "Spots"}
              value={event.capacity != null ? String(event.capacity) : "∞"}
            />
            <Stat label="Entry fee" value={event.entryFee > 0 ? `₹${event.entryFee.toLocaleString("en-IN")}` : "Free"} />
            <Stat
              label="Revenue"
              value={`₹${(event.entryFee * event.confirmedCount).toLocaleString("en-IN")}`}
              accent
            />
          </div>

          <RegistrationsSection
            registrations={registrations}
            eventStatus={event.status}
            isTeam={isTeam}
            busy={busy}
            onRefresh={() => mutate()}
          />
        </div>
      </div>
    </div>
  );
}

type StatusFilter = "all" | "confirmed" | "pending_payment" | "cancelled";

function RegistrationsSection({
  registrations,
  eventStatus,
  isTeam,
  busy,
  onRefresh,
}: {
  registrations: EventRegistration[];
  eventStatus: string;
  isTeam: boolean;
  busy: boolean;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const counts = useMemo(() => {
    const c = { all: registrations.length, confirmed: 0, pending_payment: 0, cancelled: 0 };
    for (const r of registrations) {
      if (r.status === "confirmed") c.confirmed += 1;
      else if (r.status === "pending_payment") c.pending_payment += 1;
      else if (r.status === "cancelled") c.cancelled += 1;
    }
    return c;
  }, [registrations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrations.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      const haystack = [
        r.customerName,
        r.teamName ?? "",
        r.customerMobile,
        ...r.participants.map((p) => p.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [registrations, filter, query]);

  const chips: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "confirmed", label: "Confirmed", count: counts.confirmed },
    { id: "pending_payment", label: "Awaiting payment", count: counts.pending_payment },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div id="registrations" className="mt-6 scroll-mt-6">
      {registrations.length === 0 ? (
        <>
          <h2 className="text-lg font-medium">
            Registrations <span className="text-zinc-500">({counts.all})</span>
          </h2>
          <div className="mt-3 glass rounded-2xl p-8 text-center text-sm text-zinc-500">
            {eventStatus === "published"
              ? "No one has registered yet. Share your event with customers — registrations will show up here."
              : "Publish this event to start accepting registrations. Saved details stay on this page."}
          </div>
        </>
      ) : (
        <>
          {/* Sticky toolbar: heading, search and filters stay pinned while the list scrolls */}
          <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-[#050505] px-1 pb-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">
                Registrations <span className="text-zinc-500">({counts.all})</span>
              </h2>
              <button
                type="button"
                disabled={busy}
                onClick={onRefresh}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
              >
                <span aria-hidden>↻</span> Refresh
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isTeam ? "Search by team, captain, or phone…" : "Search by name or phone…"}
              className="field-input w-full py-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => {
                const active = filter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilter(chip.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {chip.label}
                    <span className={`ml-1.5 ${active ? "text-emerald-300/80" : "text-zinc-600"}`}>
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-3 glass rounded-2xl p-8 text-center text-sm text-zinc-500">
              No registrations match your search.
            </div>
          ) : (
            <ul className="mt-1 space-y-2">
              {visible.map((r) => (
                <RegistrationRow key={r.id} reg={r} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="w-32 shrink-0 text-zinc-500">{label}</span>
      <span className="whitespace-pre-wrap text-zinc-300">{value}</span>
    </div>
  );
}

function RegistrationRow({ reg }: { reg: EventRegistration }) {
  const cancelled = reg.status === "cancelled";
  const pending = reg.status === "pending_payment";
  const tel = reg.customerMobile ? `tel:${reg.customerMobile.replace(/\s/g, "")}` : null;
  const title = reg.teamName || reg.customerName || "Registrant";
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <li
      className={`rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-white/15 ${
        cancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/8 text-sm font-semibold text-zinc-200">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-100">{title}</p>
            <p className="truncate text-xs text-zinc-500">
              {reg.teamName ? `Captain · ${reg.customerName}` : "Individual"}
              {tel && (
                <>
                  {" · "}
                  <a href={tel} className="text-zinc-400 hover:text-zinc-200">
                    {reg.customerMobile}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm text-zinc-300">
            {reg.amount > 0 ? `₹${reg.amount.toLocaleString("en-IN")}` : "Free"}
          </span>
          <StatusBadge status={reg.status} />
        </div>
      </div>
      {reg.participants.length > 1 && (
        <p className="mt-2 border-t border-white/5 pt-2 text-xs text-zinc-500">
          <span className="text-zinc-600">Players: </span>
          {reg.participants.map((p) => p.name).join(", ")}
        </p>
      )}
      {pending && (
        <p className="mt-1.5 text-[11px] text-amber-300/90">Spot held — confirms once payment clears.</p>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    confirmed: { label: "Confirmed", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
    pending_payment: { label: "Awaiting payment", className: "border-amber-400/25 bg-amber-400/10 text-amber-300" },
    cancelled: { label: "Cancelled", className: "border-red-400/25 bg-red-400/10 text-red-300" },
  };
  const info = map[status] ?? { label: status, className: "border-white/10 bg-white/5 text-zinc-300" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}
