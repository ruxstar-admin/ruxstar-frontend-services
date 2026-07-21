"use client";

import { useMemo, useState } from "react";
import { useAdminShell } from "@/components/admin-shell";
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
import { setAdminEventStatus } from "@/lib/api";
import {
  invalidateAdminEvents,
  useAdminEventRegistrations,
  useAdminEvents,
} from "@/lib/swr-hooks";

const money = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

const EVENT_TONE: Record<string, "green" | "amber" | "red" | "zinc"> = {
  published: "green",
  draft: "amber",
  cancelled: "red",
  completed: "zinc",
};

const REG_TONE: Record<string, "green" | "amber" | "red"> = {
  confirmed: "green",
  pending_payment: "amber",
  cancelled: "red",
};

const dt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
    : "—";

export default function AdminEventsPage() {
  const [tab, setTab] = useState<"events" | "registrations">("events");
  return (
    <div className="mx-auto max-w-6xl">
      <AdminHeader title="Events" subtitle="Tournaments, events and their registrations." />
      <div className="mt-5 inline-flex rounded-xl border border-white/10 p-1">
        {(["events", "registrations"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm capitalize transition ${
              tab === t ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "events" ? <EventsList /> : <RegistrationsList />}
    </div>
  );
}

function EventsList() {
  const { isAdmin } = useAdminShell();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, status: status || undefined, page, limit: 20 }),
    [debouncedSearch, status, page],
  );
  const { data, isLoading } = useAdminEvents(params);
  const events = data?.items ?? [];

  async function changeStatus(id: string, next: string) {
    setBusyId(id);
    try {
      await setAdminEventStatus(id, next);
      await invalidateAdminEvents();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title, venue…" />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
            { value: "cancelled", label: "Cancelled" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && events.length === 0 ? (
          <LoadingRows />
        ) : events.length === 0 ? (
          <EmptyState text="No events match these filters." icon="🎪" />
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-50">{e.title || "Untitled"}</span>
                    <Pill label={e.status} tone={EVENT_TONE[e.status] ?? "zinc"} />
                    <Pill label={e.kind} tone="zinc" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[e.businessName, dt(e.startAt), e.capacity != null ? `${e.confirmedCount}/${e.capacity} joined` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-zinc-100">
                  {e.entryFee > 0 ? money(e.entryFee) : "Free"}
                </span>
                {isAdmin && e.status !== "cancelled" && e.status !== "completed" && (
                  <button
                    type="button"
                    disabled={busyId === e.id}
                    onClick={() => changeStatus(e.id, "cancelled")}
                    className="shrink-0 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                  >
                    {busyId === e.id ? "…" : "Cancel"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </>
  );
}

function RegistrationsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search);
  const params = useMemo(
    () => ({ search: debouncedSearch || undefined, status: status || undefined, page, limit: 20 }),
    [debouncedSearch, status, page],
  );
  const { data, isLoading } = useAdminEventRegistrations(params);
  const regs = data?.items ?? [];

  return (
    <>
      <Toolbar>
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search ref id, team, customer…" />
        <Select
          ariaLabel="Status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "Any status" },
            { value: "confirmed", label: "Confirmed" },
            { value: "pending_payment", label: "Pending payment" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </Toolbar>

      <div className="mt-4">
        {isLoading && regs.length === 0 ? (
          <LoadingRows />
        ) : regs.length === 0 ? (
          <EmptyState text="No registrations match these filters." icon="🎟️" />
        ) : (
          <ul className="space-y-2">
            {regs.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-50">
                      {r.teamName || r.customerName || "Registrant"}
                    </span>
                    <Pill label={r.status.replace("_", " ")} tone={REG_TONE[r.status] ?? "zinc"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {[r.eventTitle, r.customerMobile, dt(r.createdAt)].filter(Boolean).join(" · ")}
                  </p>
                  {r.refId && (
                    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-600">
                      {r.refId}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium text-zinc-100">
                  {r.amount > 0 ? money(r.amount) : "Free"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} limit={20} total={data?.total ?? 0} onPage={setPage} />
      </div>
    </>
  );
}
