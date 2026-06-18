"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  businessPhotoUrl,
  getPublicBusiness,
  getStoredUser,
  getToken,
  getUserRole,
  initiateCustomerBooking,
  listPublicBusinessSlots,
  type BusinessSlot,
  type PublicBusiness,
} from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { isPartyVenueSetup } from "@/lib/business-setup";
import {
  addDays,
  formatDayLabel,
  formatTime12,
  parseDateOnly,
  todayLocal,
  dateRangeFrom,
} from "@/lib/date-utils";
import { SlotDateNav } from "@/components/slot-date-nav";

type Props = {
  businessId: string;
  isLoggedInCustomer?: boolean;
};

function galleryUrls(business: PublicBusiness) {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const photo of business.setup.photos) {
    const url = photo.url?.trim() || (photo.id ? businessPhotoUrl(business.id, photo.id) : "");
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

function PhotoCarousel({ urls, label }: { urls: string[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (urls.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % urls.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [urls.length, paused]);

  if (urls.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/25 via-zinc-900 to-[#0a0a0b] sm:aspect-[2/1]">
        <span className="text-5xl opacity-40">📍</span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)] sm:aspect-[2/1]">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={label}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              i === index ? "opacity-100" : "opacity-0"
            } ${i === index ? "animate-ken-burns" : ""}`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-t from-black/55 via-transparent to-black/15" />
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.35)",
          }}
        />
        {urls.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => setIndex((index - 1 + urls.length) % urls.length)}
              className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-sm text-white backdrop-blur transition hover:bg-black/60 sm:left-4"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => setIndex((index + 1) % urls.length)}
              className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/40 text-sm text-white backdrop-blur transition hover:bg-black/60 sm:right-4"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
              {urls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`rounded-full transition-all ${
                    i === index ? "h-1.5 w-5 bg-white" : "h-1.5 w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur">
              {index + 1} / {urls.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function dayParts(dateStr: string, today: string) {
  const d = parseDateOnly(dateStr);
  if (!d) return { weekday: dateStr, dayNum: "", isToday: false };
  const weekday =
    dateStr === today
      ? "Today"
      : d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
  const dayNum = d.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
  return { weekday, dayNum, isToday: dateStr === today };
}

export function CustomerBookFlow({ businessId, isLoggedInCustomer = false }: Props) {
  const router = useRouter();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [rangeStart, setRangeStart] = useState(todayLocal());
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [resourceId, setResourceId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<BusinessSlot | null>(null);
  const [slots, setSlots] = useState<BusinessSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canBook, setCanBook] = useState(isLoggedInCustomer);

  const range = useMemo(() => dateRangeFrom(rangeStart), [rangeStart]);
  const today = todayLocal();

  useEffect(() => {
    if (isLoggedInCustomer) {
      setCanBook(true);
      return;
    }
    const user = getStoredUser();
    const token = getToken();
    setCanBook(Boolean(token && user && getUserRole(user) === "customer"));
  }, [isLoggedInCustomer]);

  useEffect(() => {
    if (today >= range.from && today <= range.to) {
      setSelectedDate(today);
    } else {
      setSelectedDate(range.from);
    }
    setSelectedSlot(null);
  }, [range.from, range.to, today]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate, resourceId]);

  useEffect(() => {
    let cancelled = false;
    setBusinessLoading(true);
    setError("");
    getPublicBusiness(businessId)
      .then((biz) => {
        if (!cancelled) setBusiness(biz);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load booking page.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusinessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (!business) return;
    const resources = business.setup.resources;
    if (resources.length > 1 && !resourceId) {
      setResourceId(resources[0].id);
    }
  }, [business, resourceId]);

  const loadSlots = useCallback(async () => {
    if (!resourceId && (business?.setup.resources.length ?? 0) > 1) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const slotData = await listPublicBusinessSlots(businessId, {
        from: range.from,
        to: range.to,
        resourceId: resourceId || undefined,
      });
      setSlots(slotData.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load slots.");
    } finally {
      setSlotsLoading(false);
    }
  }, [businessId, business?.setup.resources.length, range.from, range.to, resourceId]);

  useEffect(() => {
    if (!business) return;
    loadSlots();
  }, [business, loadSlots]);

  const filteredSlots = useMemo(() => {
    if (!resourceId) return slots;
    return slots.filter((s) => s.resourceId === resourceId);
  }, [slots, resourceId]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, BusinessSlot[]>();
    for (const slot of filteredSlots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    for (const [, list] of map) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [filteredSlots]);

  const datesInRange = useMemo(() => {
    const dates: string[] = [];
    let cursor = range.from;
    while (cursor <= range.to) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return dates;
  }, [range.from, range.to]);

  const openCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of filteredSlots) {
      if (slot.status === "available") {
        counts.set(slot.date, (counts.get(slot.date) ?? 0) + 1);
      }
    }
    return counts;
  }, [filteredSlots]);

  async function confirmBooking() {
    if (!selectedSlot || selectedSlot.status !== "available") return;

    const token = getToken();
    const user = getStoredUser();
    if (!token || !user) {
      router.push(`/login?next=${encodeURIComponent(`/customer/book/${businessId}`)}`);
      return;
    }

    const role = getUserRole(user);
    if (role !== "customer") {
      setError("Switch to a customer account to book. Vendors can switch back from Account.");
      return;
    }

    setBookingId(selectedSlot.id);
    setError("");
    setSuccess("");
    try {
      const { payment } = await initiateCustomerBooking({
        businessId,
        resourceId: selectedSlot.resourceId,
        startAt: selectedSlot.startAt,
      });
      await openCashfreeCheckout(
        payment.paymentSessionId,
        payment.mode === "production" ? "production" : "sandbox",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment.");
    } finally {
      setBookingId("");
    }
  }

  if (businessLoading && !business) {
    return (
      <div className="space-y-4 px-5 pt-2 sm:px-8">
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/5" />
        <div className="aspect-[16/10] animate-pulse rounded-3xl bg-white/5 sm:aspect-[2/1]" />
        <div className="glass h-64 animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <p className="text-sm text-red-200">{error || "Business not found."}</p>
        <Link
          href="/customer"
          className="mt-4 inline-block text-sm text-zinc-400 hover:text-zinc-200"
        >
          ← Back to Discover
        </Link>
      </div>
    );
  }

  const photos = galleryUrls(business);
  const isFullDay = business.setup.bookingMode === "fullDay";
  const isVenue = isPartyVenueSetup(business.typeId);

  const selectedResource = business.setup.resources.find((r) => r.id === resourceId);

  const daySlots = slotsByDate.get(selectedDate) ?? [];
  const availableDaySlots = daySlots.filter((s) => s.status === "available");

  return (
    <div className="flex flex-col px-5 pt-2 sm:px-8">
      <div>
        <Link
          href="/customer"
          className="inline-flex items-center gap-2.5 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-base leading-none">
            ←
          </span>
          <span>Discover</span>
        </Link>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* —— Left: gallery + about —— */}
        <div className="min-w-0">
          <PhotoCarousel urls={photos} label={business.name} />

          <div className="mt-4">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {business.typeLabel}
            </span>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-100 sm:text-3xl">{business.name}</h1>
            {business.address && <p className="mt-1 text-sm text-zinc-400">{business.address}</p>}
            <p className="mt-2 text-xs text-zinc-500">
              {isFullDay ? "Full-day booking" : `${business.setup.slotMinutes}-min slots`}
              {isVenue && business.setup.maxGuests ? ` · up to ${business.setup.maxGuests} guests` : ""}
            </p>
          </div>

          {business.description && (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{business.description}</p>
          )}

          {business.setup.venueRules?.trim() && (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">
                Venue rules
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {business.setup.venueRules.trim()}
              </p>
            </div>
          )}
        </div>

        {/* —— Right: sticky booking deck —— */}
        <section className="relative lg:sticky lg:top-3">
          {!canBook && (
            <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <Link
                href={`/login?next=${encodeURIComponent(`/customer/book/${businessId}`)}`}
                className="font-medium underline"
              >
                Log in
              </Link>{" "}
              with a customer account to confirm a booking.
            </p>
          )}

          {error && (
            <p className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p>{success}</p>
              <Link
                href="/customer?view=bookings"
                className="mt-2 inline-block font-medium text-emerald-200 underline"
              >
                View in My bookings →
              </Link>
            </div>
          )}

          <div className="glass overflow-hidden rounded-2xl">
            <div className="border-b border-white/8 bg-white/[0.02] px-4 py-3 sm:px-5">
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/80">
                Book your slot
              </p>
              <p className="mt-0.5 text-sm text-zinc-400">
                {isFullDay ? "Pick a day, pay, then you're booked." : "Pick a day & time, pay, then you're booked."}
              </p>
            </div>

            <div className="p-4">
            {/* Space picker — compact dropdown */}
            {business.setup.resources.length > 1 && (
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-zinc-500">Space</span>
                <select
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
                >
                  {business.setup.resources.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#0c0c0e]">
                      {r.name}
                      {r.pricePerSlot != null
                        ? ` · ₹${r.pricePerSlot.toLocaleString("en-IN")}${isFullDay ? "/day" : "/slot"}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className={business.setup.resources.length > 1 ? "mt-3" : ""}>
              <SlotDateNav
                rangeStart={range.from}
                rangeEnd={range.to}
                onRangeStartChange={setRangeStart}
              />
            </div>

            {/* Date rail */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {datesInRange.map((date) => {
                const { weekday, dayNum } = dayParts(date, today);
                const open = openCountByDate.get(date) ?? 0;
                const active = selectedDate === date;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`flex min-w-[3.5rem] shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 transition ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                      {weekday}
                    </span>
                    <span className="mt-0.5 text-base font-semibold leading-none">{dayNum}</span>
                    <span
                      className={`mt-1 h-1 w-1 rounded-full ${
                        open > 0 ? "bg-emerald-400" : "bg-zinc-600"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Slot chips */}
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-zinc-200">
                  {formatDayLabel(selectedDate)}
                </h3>
                <span className="shrink-0 text-xs text-zinc-600">
                  {slotsLoading
                    ? "Loading…"
                    : availableDaySlots.length > 0
                      ? `${availableDaySlots.length} open`
                      : "None open"}
                </span>
              </div>

              {slotsLoading ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : daySlots.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">No slots on this day. Try another date.</p>
              ) : isFullDay ? (
                <div className="mt-3 space-y-2 max-h-[15rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {daySlots.map((slot) => {
                    const available = slot.status === "available";
                    const picked = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!available || Boolean(bookingId)}
                        onClick={() => available && setSelectedSlot(slot)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${
                          picked
                            ? "border-emerald-400/50 bg-emerald-500/15"
                            : available
                              ? "border-white/10 bg-white/[0.03] hover:border-emerald-500/30"
                              : "border-white/5 bg-white/[0.01] opacity-50"
                        }`}
                      >
                        <span className="font-medium text-zinc-100">Full day</span>
                        <span className="font-semibold text-zinc-200">
                          {available ? `₹${slot.pricePerSlot.toLocaleString("en-IN")}` : "Taken"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 grid max-h-[15rem] grid-cols-3 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {daySlots.map((slot) => {
                    const available = slot.status === "available";
                    const picked = selectedSlot?.id === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!available || Boolean(bookingId)}
                        onClick={() => available && setSelectedSlot(slot)}
                        title={`${formatTime12(slot.startTime)} – ${formatTime12(slot.endTime)} · ₹${slot.pricePerSlot.toLocaleString("en-IN")}`}
                        className={`rounded-lg border px-1 py-2 text-center transition disabled:cursor-default ${
                          picked
                            ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                            : available
                              ? "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                              : "border-white/5 bg-white/[0.01] text-zinc-600 line-through"
                        }`}
                      >
                        <span className="block text-xs font-semibold leading-tight">
                          {formatTime12(slot.startTime)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500">
                          ₹{slot.pricePerSlot.toLocaleString("en-IN")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sticky confirm bar inside booking deck */}
          {selectedSlot && selectedSlot.status === "available" && (
            <div className="border-t border-white/8 bg-[#0c0c0e] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Your selection</p>
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {formatDayLabel(selectedSlot.date)}
                    {!isFullDay && ` · ${formatTime12(selectedSlot.startTime)}`}
                    {selectedResource && ` · ${selectedResource.name}`}
                  </p>
                  <p className="text-sm font-semibold text-emerald-300">
                    ₹{selectedSlot.pricePerSlot.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(null)}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={!canBook || bookingId === selectedSlot.id}
                    onClick={() => void confirmBooking()}
                    className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {bookingId === selectedSlot.id ? "Redirecting to pay…" : "Pay & book"}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}
