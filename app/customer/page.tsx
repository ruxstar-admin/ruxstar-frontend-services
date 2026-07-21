"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CustomerView } from "@/components/customer-shell";
import {
  becomeVendor,
  cancelCustomerBooking,
  updateCustomerProfile,
  type PublicBusinessSummary,
  type RuxEvent,
} from "@/lib/api";
import {
  invalidateCustomerBookings,
  useCustomerBookings,
  useCustomerProfile,
  useMyEventRegistrations,
  usePublicBusinesses,
  usePublicEvents,
} from "@/lib/swr-hooks";
import { formatDayLabel, formatTime12 } from "@/lib/date-utils";
import { periodCoverageLabel } from "@/lib/coaching";

const input = "field-input";

function businessEmoji(biz: Pick<PublicBusinessSummary, "typeLabel" | "categoryLabel">) {
  const text = `${biz.typeLabel} ${biz.categoryLabel}`.toLowerCase();
  if (/turf|sport|ground|court|football|cricket|badminton|tennis|play/.test(text)) return "⚽";
  if (/salon|spa|beauty|hair|nail|groom|makeup/.test(text)) return "💇";
  if (/venue|hall|banquet|party|wedding|function|event/.test(text)) return "🎉";
  if (/clinic|doctor|health|dental|medical|hospital|therapy|physio/.test(text)) return "🩺";
  if (/gym|fitness|yoga|workout|crossfit/.test(text)) return "🏋️";
  if (/photo|studio|creator|record/.test(text)) return "🎬";
  return "📍";
}

function priceTag(biz: PublicBusinessSummary) {
  const unit = biz.bookingMode === "fullDay" ? "day" : "slot";
  const from = biz.priceFrom || biz.pricePerSlot;
  const to = biz.priceTo || from;
  if (!from && !to) return "Free";
  if (from === to) return `₹${from.toLocaleString("en-IN")}/${unit}`;
  return `₹${from.toLocaleString("en-IN")}–${to.toLocaleString("en-IN")}/${unit}`;
}

function modeLabel(biz: PublicBusinessSummary) {
  if (biz.bookingMode === "fullDay") return "Full-day booking";
  if (biz.slotMinutes > 0) return `${biz.slotMinutes}-min slots`;
  return "Slot booking";
}

const EVENTS_CATEGORY = "Events and tournaments";

function eventTypeLabel(ev: RuxEvent) {
  return ev.tournamentType?.trim() || (ev.kind === "tournament" ? "Tournament" : "Event");
}

function eventSearchText(ev: RuxEvent) {
  return [ev.title, ev.tournamentType, ev.venue, ev.businessName, ev.description]
    .join(" ")
    .toLowerCase();
}

function businessSearchText(biz: PublicBusinessSummary) {
  return [
    biz.name,
    biz.vendorName,
    biz.typeLabel,
    biz.categoryLabel,
    biz.address,
    biz.description,
  ]
    .join(" ")
    .toLowerCase();
}

type DiscoverItem =
  | { kind: "business"; biz: PublicBusinessSummary }
  | { kind: "event"; ev: RuxEvent };

function BusinessCoverImage({ biz }: { biz: PublicBusinessSummary }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [biz.id, biz.coverUrl]);

  if (!biz.coverUrl || failed) {
    return (
      <div className="grid h-full w-full place-items-center text-4xl opacity-80">
        {businessEmoji(biz)}
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={biz.coverUrl}
        alt=""
        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
        onError={() => setFailed(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070707] to-transparent" />
    </>
  );
}

export default function CustomerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const view: CustomerView =
    viewParam === "bookings" ? "bookings" : viewParam === "account" ? "account" : "discover";

  const { data: profile, mutate: mutateProfile, isLoading: profileLoading } = useCustomerProfile(true);
  const { data: bookings = [], isLoading: bookingsLoading } = useCustomerBookings(true);
  const {
    data: businesses = [],
    error: businessesFetchError,
    isLoading: businessesLoading,
    mutate: mutatePublicBusinesses,
  } = usePublicBusinesses(true);
  const { data: events = [], isLoading: eventsLoading } = usePublicEvents(true);
  const { data: myRegistrations = [] } = useMyEventRegistrations(true);

  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancellingId, setCancellingId] = useState("");

  useEffect(() => {
    if (profile?.name !== undefined) setName(profile.name ?? "");
  }, [profile?.name]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const businessesError =
    businessesFetchError instanceof Error
      ? businessesFetchError.message
      : businessesFetchError
        ? "Could not load bookable businesses"
        : "";

  const categoryOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const b of businesses) {
      if (b.categoryLabel.trim()) labels.add(b.categoryLabel.trim());
    }
    if (events.length > 0) labels.add(EVENTS_CATEGORY);
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [businesses, events]);

  const typeOptions = useMemo(() => {
    const labels = new Set<string>();
    if (categoryFilter === EVENTS_CATEGORY) {
      for (const e of events) {
        const label = eventTypeLabel(e);
        if (label) labels.add(label);
      }
      return [...labels].sort((a, b) => a.localeCompare(b));
    }
    for (const b of businesses) {
      if (categoryFilter !== "all" && b.categoryLabel !== categoryFilter) continue;
      if (b.typeLabel.trim()) labels.add(b.typeLabel.trim());
    }
    return [...labels].sort((a, b) => a.localeCompare(b));
  }, [businesses, events, categoryFilter]);

  const totalDiscoverCount = businesses.length + events.length;

  const discoverItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items: DiscoverItem[] = [];
    const showBusinesses = categoryFilter === "all" || categoryFilter !== EVENTS_CATEGORY;
    const showEvents = categoryFilter === "all" || categoryFilter === EVENTS_CATEGORY;

    if (showBusinesses) {
      for (const b of businesses) {
        if (categoryFilter !== "all" && b.categoryLabel !== categoryFilter) continue;
        if (typeFilter !== "all" && b.typeLabel !== typeFilter) continue;
        if (q && !businessSearchText(b).includes(q)) continue;
        items.push({ kind: "business", biz: b });
      }
    }

    if (showEvents) {
      for (const e of events) {
        if (typeFilter !== "all" && eventTypeLabel(e) !== typeFilter) continue;
        if (q && !eventSearchText(e).includes(q)) continue;
        items.push({ kind: "event", ev: e });
      }
    }

    return items;
  }, [businesses, events, query, categoryFilter, typeFilter]);

  const hasActiveFilters =
    query.trim().length > 0 || categoryFilter !== "all" || typeFilter !== "all";

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: typeof bookings = [];
    const old: typeof bookings = [];
    for (const b of bookings) {
      if (new Date(b.startAt).getTime() > now && b.status !== "cancelled") up.push(b);
      else old.push(b);
    }
    up.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    old.sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));
    return { upcoming: up, past: old };
  }, [bookings]);

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateCustomerProfile(name.trim());
      await mutateProfile(updated, { revalidate: false });
      setName(updated.name ?? "");
      setEditing(false);
      setNotice("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSavingName(false);
    }
  }

  async function onCancelBooking(id: string) {
    setCancellingId(id);
    setError("");
    try {
      await cancelCustomerBooking(id);
      await invalidateCustomerBookings();
      setNotice("Booking cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking.");
    } finally {
      setCancellingId("");
    }
  }

  async function onBecomeVendor(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUpgrading(true);
    try {
      await becomeVendor(businessName.trim() || undefined);
      router.replace("/business");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch to a business account");
      setUpgrading(false);
    }
  }

  return (
    <>
      {view !== "discover" && view !== "bookings" && error && (
        <p className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      )}
      {view !== "discover" && view !== "bookings" && notice && (
        <p className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </p>
      )}

      {view === "discover" && (
              <section className="flex h-full min-h-0 flex-col">
                <div className="shrink-0">
                  {error && (
                    <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {notice}
                    </p>
                  )}

                  <div>
                    <h1 className="text-2xl font-semibold sm:text-3xl">
                      Discover <span className="text-gradient">places & events</span>
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">
                      {businessesLoading || eventsLoading
                        ? "Loading…"
                        : `${totalDiscoverCount} ${totalDiscoverCount === 1 ? "listing" : "listings"} live right now`}
                    </p>
                  </div>

                  {!businessesLoading && !eventsLoading && totalDiscoverCount > 0 && (
                    <div className="mt-5 space-y-3 border-b border-white/5 pb-4">
                    <div className="relative">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search turfs, salons, venues, events, tournaments…"
                        className={`${input} w-full`}
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {categoryOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          active={categoryFilter === "all"}
                          onClick={() => {
                            setCategoryFilter("all");
                            setTypeFilter("all");
                          }}
                          label="All"
                        />
                        {categoryOptions.map((label) => (
                          <FilterChip
                            key={label}
                            active={categoryFilter === label}
                            onClick={() => {
                              setCategoryFilter(label);
                              setTypeFilter("all");
                            }}
                            label={label}
                          />
                        ))}
                      </div>
                    )}

                    {categoryFilter !== "all" && typeOptions.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          active={typeFilter === "all"}
                          onClick={() => setTypeFilter("all")}
                          label="All types"
                        />
                        {typeOptions.map((label) => (
                          <FilterChip
                            key={label}
                            active={typeFilter === label}
                            onClick={() => setTypeFilter(label)}
                            label={label}
                          />
                        ))}
                      </div>
                    )}

                    {hasActiveFilters && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                        <span>
                          Showing {discoverItems.length} of {totalDiscoverCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("");
                            setCategoryFilter("all");
                            setTypeFilter("all");
                          }}
                          className="rounded-full border border-white/10 px-2.5 py-1 hover:bg-white/5"
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                  </div>
                  )}
                </div>

                <div className="scroll-pane min-h-0 flex-1 pt-4">
                {businessesLoading || eventsLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-56 animate-pulse rounded-2xl bg-white/5" />
                    ))}
                  </div>
                ) : businessesError ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <p className="text-sm text-amber-200/90">{businessesError}</p>
                    <button
                      type="button"
                      onClick={() => void mutatePublicBusinesses()}
                      className="mt-3 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                    >
                      Try again
                    </button>
                  </div>
                ) : totalDiscoverCount === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
                    <p className="text-3xl">🛎️</p>
                    <p className="mt-3 text-sm text-zinc-400">Nothing to discover yet.</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Vendors must finish setup and publish before listings appear here.
                    </p>
                  </div>
                ) : discoverItems.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
                    <p className="text-sm text-zinc-400">No listings match your search.</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setCategoryFilter("all");
                          setTypeFilter("all");
                        }}
                        className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
                    {discoverItems.map((item) =>
                      item.kind === "business" ? (
                        <li key={`biz-${item.biz.id}`}>
                          <Link
                            href={`/customer/book/${item.biz.id}`}
                            className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]"
                          >
                            <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-emerald-500/15 via-white/5 to-transparent">
                              <BusinessCoverImage biz={item.biz} />
                              <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-200 backdrop-blur">
                                {item.biz.typeLabel || item.biz.categoryLabel}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col p-4">
                              <h3 className="text-base font-semibold text-zinc-100">{item.biz.name}</h3>
                              {item.biz.vendorName && (
                                <p className="mt-0.5 text-xs text-zinc-500">by {item.biz.vendorName}</p>
                              )}
                              {item.biz.address && (
                                <p className="mt-1 flex items-start gap-1 text-xs text-zinc-500">
                                  <span aria-hidden>📍</span>
                                  <span className="truncate">{item.biz.address}</span>
                                </p>
                              )}
                              {item.biz.description && (
                                <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                                  {item.biz.description}
                                </p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                                <span className="text-zinc-400">{modeLabel(item.biz)}</span>
                                {item.biz.resourceCount > 1 && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{item.biz.resourceCount} options</span>
                                  </>
                                )}
                                {item.biz.bookingMode === "fullDay" && item.biz.maxGuests ? (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>up to {item.biz.maxGuests} guests</span>
                                  </>
                                ) : null}
                              </div>

                              <div className="mt-auto flex items-center justify-between pt-4">
                                <span className="text-sm font-semibold text-emerald-300">
                                  {priceTag(item.biz)}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200 transition group-hover:bg-emerald-500/20 group-hover:text-emerald-200">
                                  Book →
                                </span>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ) : (
                        <li key={`ev-${item.ev.id}`}>
                          <button
                            type="button"
                            onClick={() => router.push(`/customer/events/${item.ev.id}`)}
                            className="group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] text-left transition hover:border-white/20 hover:bg-white/[0.04]"
                          >
                            <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-violet-500/20 via-white/5 to-transparent">
                              {item.ev.coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.ev.coverUrl}
                                  alt={item.ev.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-4xl opacity-80">
                                  {item.ev.kind === "tournament" ? "🏆" : "🎫"}
                                </div>
                              )}
                              <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-200 backdrop-blur">
                                {eventTypeLabel(item.ev)}
                              </span>
                              {item.ev.spotsLeft != null && item.ev.spotsLeft <= 5 && item.ev.spotsLeft > 0 && (
                                <span className="absolute right-3 top-3 rounded-full bg-amber-500/80 px-2 py-1 text-[10px] font-semibold text-black">
                                  {item.ev.spotsLeft} left
                                </span>
                              )}
                              {item.ev.spotsLeft === 0 && (
                                <span className="absolute right-3 top-3 rounded-full bg-red-500/80 px-2 py-1 text-[10px] font-semibold text-white">
                                  Full
                                </span>
                              )}
                            </div>
                            <div className="flex flex-1 flex-col p-4">
                              <h3 className="text-base font-semibold text-zinc-100">{item.ev.title}</h3>
                              <p className="mt-0.5 text-xs text-zinc-500">{item.ev.businessName}</p>
                              <p className="mt-2 flex items-start gap-1 text-xs text-zinc-500">
                                <span aria-hidden>🗓️</span>
                                <span className="truncate">{eventWhen(item.ev.startAt)}</span>
                              </p>
                              {item.ev.venue && (
                                <p className="mt-1 flex items-start gap-1 text-xs text-zinc-500">
                                  <span aria-hidden>📍</span>
                                  <span className="truncate">{item.ev.venue}</span>
                                </p>
                              )}
                              <div className="mt-auto flex items-center justify-between pt-4">
                                <span className="text-sm font-semibold text-emerald-300">
                                  {item.ev.entryFee > 0
                                    ? `₹${item.ev.entryFee.toLocaleString("en-IN")}`
                                    : "Free"}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-200 transition group-hover:bg-emerald-500/20 group-hover:text-emerald-200">
                                  {item.ev.format === "team" ? "Register team →" : "Register →"}
                                </span>
                              </div>
                            </div>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                )}
                </div>
              </section>
            )}

            {view === "bookings" && (
              <section className="flex h-full min-h-0 flex-col">
                <div className="shrink-0 border-b border-white/5 pb-4">
                  {error && (
                    <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {notice}
                    </p>
                  )}

                  <h1 className="text-2xl font-semibold sm:text-3xl">My bookings</h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    Your slot bookings and event registrations.
                  </p>
                </div>

                <div className="scroll-pane min-h-0 flex-1 pt-4">
                {bookingsLoading ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
                    ))}
                  </div>
                ) : bookings.length === 0 && myRegistrations.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
                    <p className="text-3xl">🎟️</p>
                    <p className="mt-3 text-sm text-zinc-400">No bookings yet.</p>
                    <button
                      type="button"
                      onClick={() => router.push("/customer")}
                      className="btn-primary mt-5 rounded-full px-6 py-2.5 text-sm font-semibold"
                    >
                      Find a place to book
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8 pb-4">
                    {upcoming.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-400/80">
                          Upcoming
                        </p>
                        <ul className="space-y-2">
                          {upcoming.map((b) => (
                            <BookingRow
                              key={b.id}
                              booking={b}
                              cancelling={cancellingId === b.id}
                              onCancel={() => onCancelBooking(b.id)}
                            />
                          ))}
                        </ul>
                      </div>
                    )}
                    {past.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
                          Past & cancelled
                        </p>
                        <ul className="space-y-2">
                          {past.map((b) => (
                            <BookingRow key={b.id} booking={b} past />
                          ))}
                        </ul>
                      </div>
                    )}
                    <MyEventsSection
                      registrations={myRegistrations}
                      onOpen={(id) => router.push(`/customer/events/${id}`)}
                    />
                  </div>
                )}
                </div>
              </section>
            )}

            {view === "account" && (
              <section className="max-w-2xl">
                <h1 className="text-2xl font-semibold sm:text-3xl">Account</h1>
                <p className="mt-1 text-sm text-zinc-500">Manage your profile and vendor access.</p>

                <div className="mt-6 glass rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-medium">Profile</h2>
                    {!editing && !profileLoading && (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-sm text-zinc-400 transition hover:text-zinc-200"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {profileLoading ? (
                    <p className="mt-4 text-sm text-zinc-500">Loading…</p>
                  ) : editing ? (
                    <form onSubmit={onSaveName} className="mt-4 space-y-4">
                      <label className="block text-sm text-zinc-400">
                        Name
                        <input
                          className={`${input} mt-2`}
                          value={name}
                          autoComplete="name"
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm text-zinc-400">
                        Mobile
                        <input
                          className={`${input} mt-2 opacity-60`}
                          value={profile?.mobile ? `+91 ${profile.mobile}` : ""}
                          disabled
                        />
                        <span className="mt-1 block text-xs text-zinc-600">
                          Mobile number can&apos;t be changed here — it&apos;s tied to your login.
                        </span>
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false);
                            setName(profile?.name ?? "");
                            setError("");
                          }}
                          className="flex-1 rounded-full border border-white/10 py-2.5 text-sm hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingName}
                          className="btn-primary flex-1 rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                        >
                          {savingName ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4 text-sm">
                      <div>
                        <dt className="text-zinc-500">Name</dt>
                        <dd className="mt-0.5 text-zinc-100">{profile?.name || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Mobile</dt>
                        <dd className="mt-0.5 text-zinc-100">
                          {profile?.mobile ? `+91 ${profile.mobile}` : "—"}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                <div className="mt-4 glass rounded-2xl p-5 sm:p-6">
                  <h2 className="text-base font-medium">Run a business on Ruxstar</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Open a vendor dashboard, complete KYC, and onboard your turf, salon, venue, or
                    clinic. Your customer account stays — switch back anytime.
                  </p>
                  {showUpgrade ? (
                    <form onSubmit={onBecomeVendor} className="mt-4 space-y-3">
                      <label className="block text-sm text-zinc-400">
                        Business name <span className="text-zinc-600">(optional)</span>
                        <input
                          className={`${input} mt-2`}
                          value={businessName}
                          placeholder={profile?.name ? `${profile.name}'s business` : "Your business name"}
                          onChange={(e) => setBusinessName(e.target.value)}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={upgrading}
                        className="btn-primary w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-60"
                      >
                        {upgrading ? "Switching…" : "Open vendor dashboard"}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUpgrade(true)}
                      className="mt-4 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/5"
                    >
                      Become a business
                    </button>
                  )}
                </div>
              </section>
            )}
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-white/15 text-zinc-100"
          : "border border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function eventWhen(iso: string | null) {
  if (!iso) return "Date TBD";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function MyEventsSection({
  registrations,
  onOpen,
}: {
  registrations: {
    id: string;
    eventId: string;
    eventTitle: string;
    startAt: string | null;
    amount: number;
    status: string;
    teamName: string | null;
    kind: string;
  }[];
  onOpen: (eventId: string) => void;
}) {
  if (registrations.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-violet-300/80">
        Events & tournaments
      </p>
      <ul className="space-y-2">
        {registrations.map((r) => {
          const pending = r.status === "pending_payment";
          return (
            <li
              key={r.id}
              className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                pending ? "border-amber-400/20 bg-amber-400/[0.03]" : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/5 text-xl">
                {r.kind === "tournament" ? "🏆" : "🎫"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-zinc-100">{r.eventTitle}</p>
                <p className="truncate text-sm text-zinc-500">
                  {r.teamName ? `${r.teamName} · ` : ""}
                  {eventWhen(r.startAt)}
                </p>
                <div className="mt-1.5">
                  <BookingStatusBadge status={r.status} paymentStatus={pending ? "pending" : "paid"} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm text-zinc-300">
                  {r.amount > 0 ? `₹${r.amount.toLocaleString("en-IN")}` : "Free"}
                </span>
                <button
                  type="button"
                  onClick={() => onOpen(r.eventId)}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  View
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BookingStatusBadge({ status, paymentStatus }: { status: string; paymentStatus?: string | null }) {
  let label = "Confirmed";
  let cls = "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  if (status === "cancelled") {
    label = "Cancelled";
    cls = "border-red-400/25 bg-red-400/10 text-red-300";
  } else if (status === "pending_payment" || paymentStatus === "pending") {
    label = "Awaiting payment";
    cls = "border-amber-400/25 bg-amber-400/10 text-amber-300";
  } else if (status === "expired" || paymentStatus === "failed") {
    label = "Payment failed";
    cls = "border-red-400/25 bg-red-400/10 text-red-300";
  } else if (paymentStatus === "paid") {
    label = "Paid";
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function BookingRow({
  booking,
  cancelling,
  onCancel,
  past,
}: {
  booking: {
    id: string;
    refId?: string | null;
    businessName: string;
    resourceName: string;
    serviceLabel?: string;
    startAt: string;
    pricePerSlot: number;
    amount?: number;
    status: string;
    paymentStatus?: string | null;
    paymentRefId?: string | null;
    periodKind?: "exact" | "day" | "week" | "month";
    periodKey?: string;
    slots?: { startAt: string; endAt: string }[] | null;
  };
  cancelling?: boolean;
  onCancel?: () => void;
  past?: boolean;
}) {
  const start = new Date(booking.startAt);
  const weekday = start.toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
  const dayNum = start.toLocaleDateString("en-IN", {
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  const istTime = start.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const timeLabel = formatTime12(istTime);
  const dateLabel = formatDayLabel(booking.startAt.slice(0, 10));
  const cancelled = booking.status === "cancelled";
  const pending = booking.status === "pending_payment" || booking.paymentStatus === "pending";
  const amount = typeof booking.amount === "number" ? booking.amount : booking.pricePerSlot;
  const periodLabel = periodCoverageLabel(booking.periodKind, booking.periodKey);

  return (
    <li
      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
        pending
          ? "border-amber-400/20 bg-amber-400/[0.03]"
          : "border-white/5 bg-white/[0.02]"
      } ${past ? "opacity-70" : ""}`}
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/5 text-center">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{weekday}</span>
        <span className="text-base font-semibold leading-none text-zinc-100">{dayNum}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{booking.businessName}</p>
        <p className="truncate text-sm text-zinc-500">
          {[booking.serviceLabel, booking.resourceName].filter(Boolean).join(" · ")} · {dateLabel} ·{" "}
          {booking.slots && booking.slots.length > 1
            ? `${booking.slots.length} slots from ${timeLabel}`
            : timeLabel}
        </p>
        {(booking.refId || booking.paymentRefId) && (
          <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">
            {booking.refId ?? ""}
            {booking.refId && booking.paymentRefId ? " · " : ""}
            {booking.paymentRefId ?? ""}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <BookingStatusBadge status={booking.status} paymentStatus={booking.paymentStatus} />
          {periodLabel && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
              {booking.periodKind === "month"
                ? "Monthly"
                : booking.periodKind === "week"
                  ? "Weekly"
                  : "Day pass"}{" "}
              · covers {periodLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm text-zinc-300">₹{amount.toLocaleString("en-IN")}</span>
        {cancelled ? null : pending ? (
          <span className="text-xs text-amber-300/70">Hold</span>
        ) : onCancel ? (
          <button
            type="button"
            disabled={cancelling}
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-red-300 disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Done</span>
        )}
      </div>
    </li>
  );
}
