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
  type PricingModel,
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
import { CoachingBookingGuide } from "@/components/coaching-booking-guide";
import {
  coachingPaymentFilters,
  customerConfirmPaymentLine,
  formatEnrollmentLabel,
  formatPriceOption,
  formatServicePriceSummary,
  isBatchClass,
  periodCoverageLabel,
  pricingModelCustomerLabel,
  selectionKindForOption,
  serviceMatchesPaymentFilter,
  servicePriceOptions,
  type SelectionKind,
} from "@/lib/coaching";
import type { PriceOption } from "@/lib/api";

/** Short line describing what a payment option gets the customer. */
function optionCoverage(opt: PriceOption): string {
  const kind = selectionKindForOption(opt);
  if (kind === "month") return "Whole-month pass · all sessions";
  if (kind === "week") return "Whole-week pass · all sessions";
  if (kind === "day") return "Book a whole day";
  if (opt.pricingModel === "hourly") return "Per session · billed hourly";
  return "Single class";
}

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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModel | "">("");
  const [selectedSlot, setSelectedSlot] = useState<BusinessSlot | null>(null);
  // Hourly resource bookings (e.g. a turf) can pick several time slots at once
  // and pay for them together; other flows stay single-select via selectedSlot.
  const [selectedSlots, setSelectedSlots] = useState<BusinessSlot[]>([]);
  const [slots, setSlots] = useState<BusinessSlot[]>([]);
  const [periods, setPeriods] = useState<BusinessSlot[]>([]);
  const [selectionKind, setSelectionKind] = useState<SelectionKind>("time");
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [bookingId, setBookingId] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
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
    setSelectedSlots([]);
  }, [range.from, range.to, today]);

  useEffect(() => {
    setSelectedSlot(null);
    setSelectedSlots([]);
  }, [selectedDate, resourceId, staffId, selectedServiceIds, pricingModel]);

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

  const isService = business?.setup.bookingMode === "services";
  const isCoaching = business?.typeId === "coaching";

  const coachingServices = business?.setup.services ?? [];
  const paymentTabs = useMemo(
    () => (isCoaching ? coachingPaymentFilters(coachingServices) : []),
    [isCoaching, coachingServices],
  );
  const visibleCoachingServices = useMemo(
    () =>
      isCoaching
        ? coachingServices.filter((s) => serviceMatchesPaymentFilter(s, paymentFilter))
        : coachingServices,
    [isCoaching, coachingServices, paymentFilter],
  );
  const selectedService = useMemo(
    () => business?.setup.services.find((s) => selectedServiceIds.includes(s.id)),
    [business, selectedServiceIds],
  );
  const servicePayOptions = useMemo(
    () => (selectedService ? servicePriceOptions(selectedService) : []),
    [selectedService],
  );

  // Default to the class's primary payment option whenever the selected
  // class changes; clear it once no class (or several) is selected.
  useEffect(() => {
    if (servicePayOptions.length) {
      setPricingModel((prev) =>
        servicePayOptions.some((o) => o.pricingModel === prev) ? prev : servicePayOptions[0].pricingModel,
      );
    } else {
      setPricingModel("");
    }
  }, [servicePayOptions]);

  useEffect(() => {
    if (!business) return;
    if (isService) return;
    const resources = business.setup.resources;
    if (resources.length > 1 && !resourceId) {
      setResourceId(resources[0].id);
    }
  }, [business, resourceId, isService]);

  // Staff who can perform every selected service (for the staff picker).
  const eligibleStaff = useMemo(() => {
    if (!business || !isService) return [];
    const staff = business.setup.staff ?? [];
    const services = business.setup.services ?? [];
    if (selectedServiceIds.length === 0) return staff;
    const selected = services.filter((s) => selectedServiceIds.includes(s.id));
    return staff.filter((st) => selected.every((s) => s.staffIds.includes(st.id)));
  }, [business, isService, selectedServiceIds]);

  // Drop a chosen staff member if they can no longer do the selected services.
  useEffect(() => {
    if (staffId && !eligibleStaff.some((s) => s.id === staffId)) setStaffId("");
  }, [eligibleStaff, staffId]);

  const loadSlots = useCallback(async () => {
    if (!business) return;
    const serviceMode = business.setup.bookingMode === "services";
    if (serviceMode && selectedServiceIds.length === 0) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    if (!serviceMode && !resourceId && (business.setup.resources.length ?? 0) > 1) return;
    setSlotsLoading(true);
    setSlots([]);
    setPeriods([]);
    setSelectedSlot(null);
    setSelectedSlots([]);
    try {
      const slotData = await listPublicBusinessSlots(businessId, {
        from: range.from,
        to: range.to,
        resourceId: serviceMode ? undefined : resourceId || undefined,
        serviceIds: serviceMode ? selectedServiceIds : undefined,
        staffId: serviceMode && staffId ? staffId : undefined,
        pricingModel: serviceMode && pricingModel ? pricingModel : undefined,
      });
      setSlots(slotData.slots);
      setPeriods(slotData.periods ?? []);
      setSelectionKind(slotData.selectionKind ?? "time");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load slots.");
    } finally {
      setSlotsLoading(false);
    }
  }, [businessId, business, range.from, range.to, resourceId, selectedServiceIds, staffId, pricingModel]);

  useEffect(() => {
    if (!business) return;
    loadSlots();
  }, [business, loadSlots]);

  const filteredSlots = useMemo(() => {
    if (isService || !resourceId) return slots;
    return slots.filter((s) => s.resourceId === resourceId);
  }, [slots, resourceId, isService]);

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
    const multi =
      !isService && selectionKind === "time" && business?.setup.bookingMode !== "fullDay";
    const chosen = multi
      ? [...selectedSlots].sort((a, b) => a.startAt.localeCompare(b.startAt))
      : selectedSlot
        ? [selectedSlot]
        : [];
    const bookable = chosen.filter((s) => s.status === "available");
    if (!bookable.length) return;

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

    setBookingId(multi ? "multi" : bookable[0].id);
    setError("");
    setSuccess("");
    try {
      const { payment } = await initiateCustomerBooking({
        businessId,
        startAt: bookable[0].startAt,
        ...(isService
          ? {
              serviceIds: selectedServiceIds,
              ...(staffId ? { staffId } : {}),
              ...(isCoaching && pricingModel ? { pricingModel } : {}),
            }
          : {
              resourceId: bookable[0].resourceId,
              ...(bookable.length > 1 ? { startAts: bookable.map((s) => s.startAt) } : {}),
            }),
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

  // Coaching week/month passes are selected as period chips (not a time grid).
  const isPeriodSelect = isCoaching && (selectionKind === "week" || selectionKind === "month");
  // A whole-day (daily) coaching booking, or a full-day resource, is picked as
  // one button per day rather than a time slot.
  const wholeDayMode = isFullDay || selectionKind === "day";
  // Hourly resource slots (turf/venue) let the customer stack several slots
  // (e.g. 6–9) into one paid booking.
  const multiSlotMode = !isService && selectionKind === "time" && !wholeDayMode;
  const toggleSlot = (slot: BusinessSlot) =>
    setSelectedSlots((prev) =>
      prev.some((s) => s.id === slot.id)
        ? prev.filter((s) => s.id !== slot.id)
        : [...prev, slot],
    );
  const selectedSlotsSorted = [...selectedSlots].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const selectedSlotsTotal = selectedSlotsSorted.reduce((sum, s) => sum + s.pricePerSlot, 0);

  // Class/service browser — rendered in the wide left column for coaching,
  // and inside the deck for other service businesses.
  const browserServices = isCoaching ? visibleCoachingServices : business.setup.services;
  const classBrowser = (
    <div className="space-y-3">
      {isCoaching && paymentTabs.length > 2 && (
        <div>
          <p className="text-xs font-medium text-zinc-500">Filter by payment</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {paymentTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPaymentFilter(tab.id);
                  setSelectedServiceIds([]);
                  setSelectedSlot(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  paymentFilter === tab.id
                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
                    : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-zinc-500">
          {isCoaching ? "Step 1 · Choose a class" : "Choose service(s)"}
        </p>
        <div className={isCoaching ? "mt-2 grid gap-2 sm:grid-cols-2" : "mt-2 space-y-1.5"}>
          {browserServices.length === 0 && (
            <p className="text-sm text-zinc-600">
              {isCoaching && paymentFilter !== "all"
                ? "No classes with this payment type."
                : "No services available yet."}
            </p>
          )}
          {browserServices.map((svc) => {
            const on = selectedServiceIds.includes(svc.id);
            const options = servicePriceOptions(svc);
            const priceText = formatServicePriceSummary(svc);
            const enrollLabel = formatEnrollmentLabel(svc.enrollmentType, svc.maxParticipants);
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() =>
                  setSelectedServiceIds((prev) => {
                    if (isCoaching) return prev.includes(svc.id) ? [] : [svc.id];
                    return prev.includes(svc.id)
                      ? prev.filter((x) => x !== svc.id)
                      : [...prev, svc.id];
                  })
                }
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  on
                    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-emerald-500/30"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{svc.name}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {isCoaching && (
                      <span className="text-emerald-400/80">
                        {options.length > 1
                          ? `${options.length} payment options`
                          : pricingModelCustomerLabel(options[0].pricingModel)}
                        {" · "}
                      </span>
                    )}
                    {svc.durationMinutes} min
                    {enrollLabel ? ` · ${enrollLabel}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-semibold leading-tight">
                  {priceText}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

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

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_28rem]">
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
              {isCoaching
                ? `${business.setup.services.length} class${business.setup.services.length === 1 ? "" : "es"} · Hourly, daily, weekly & monthly options`
                : isService
                  ? `${business.setup.services.length} service${business.setup.services.length === 1 ? "" : "s"} · ${business.setup.staff.length} staff`
                  : isFullDay
                    ? "Full-day booking"
                    : `${business.setup.slotMinutes}-min slots`}
              {!isService && isVenue && business.setup.maxGuests
                ? ` · up to ${business.setup.maxGuests} guests`
                : ""}
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

          {/* Coaching class browser fills the wide left column */}
          {isCoaching && (
            <div className="glass mt-5 rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/80">
                Classes on offer
              </p>
              <p className="mt-0.5 mb-3 text-sm text-zinc-400">
                Pick a class, then set it up on the right.
              </p>
              {classBrowser}
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
                {isCoaching ? "Enroll in a class" : "Book your slot"}
              </p>
              <p className="mt-0.5 text-sm text-zinc-400">
                {isCoaching
                  ? "Choose class → pick time → pay (hourly, daily, weekly, or monthly)."
                  : isFullDay
                    ? "Pick a day, pay, then you're booked."
                    : "Pick a day & time, pay, then you're booked."}
              </p>
              {isCoaching && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
                  <span className="rounded-md bg-white/[0.04] px-2 py-0.5">1 · Class</span>
                  <span>→</span>
                  {servicePayOptions.length > 1 && (
                    <>
                      <span className="rounded-md bg-white/[0.04] px-2 py-0.5">2 · Payment</span>
                      <span>→</span>
                    </>
                  )}
                  <span className="rounded-md bg-white/[0.04] px-2 py-0.5">
                    {servicePayOptions.length > 1 ? "3" : "2"} · Time
                  </span>
                  <span>→</span>
                  <span className="rounded-md bg-white/[0.04] px-2 py-0.5">
                    {servicePayOptions.length > 1 ? "4" : "3"} · Pay
                  </span>
                </div>
              )}
            </div>

            <div className="p-4">
            {/* Service-first picker — services then staff */}
            {isService && (
              <div className="space-y-3">
                {!isCoaching && classBrowser}

                {isCoaching && !selectedService && (
                  <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                    ← Pick a class from <span className="text-zinc-300">Classes on offer</span> to
                    choose payment &amp; time.
                  </p>
                )}

                {isCoaching && selectedService && (
                  <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-emerald-400/80">
                      Selected class
                    </p>
                    <p className="text-sm font-semibold text-emerald-100">{selectedService.name}</p>
                  </div>
                )}

                {isCoaching && selectedService && servicePayOptions.length > 1 && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Step 2 · Choose payment type</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {servicePayOptions.map((opt) => {
                        const on = pricingModel === opt.pricingModel;
                        return (
                          <button
                            key={opt.pricingModel}
                            type="button"
                            onClick={() => setPricingModel(opt.pricingModel)}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                              on
                                ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
                                : "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-emerald-500/40"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">
                                {pricingModelCustomerLabel(opt.pricingModel)}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-zinc-500">
                                {optionCoverage(opt)}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-sm font-semibold text-emerald-300">
                              {formatPriceOption(opt, selectedService.durationMinutes)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isCoaching && selectedService && (
                  <CoachingBookingGuide
                    service={selectedService}
                    selectedDate={selectedDate}
                    selectedModel={pricingModel || undefined}
                  />
                )}

                {selectedServiceIds.length > 0 && (
                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-xs font-medium text-zinc-500">With</span>
                    <select
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
                    >
                      <option value="" className="bg-[#0c0c0e]">
                        Anyone available
                      </option>
                      {eligibleStaff.map((st) => (
                        <option key={st.id} value={st.id} className="bg-[#0c0c0e]">
                          {st.name}
                          {st.role ? ` · ${st.role}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {/* Space picker — compact dropdown */}
            {!isService && business.setup.resources.length > 1 && (
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

            {isService && selectedServiceIds.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-600">
                {isCoaching
                  ? "Pick a class from the left to see times and payment details."
                  : "Pick a service to see available times."}
              </p>
            ) : (
            <>
            {isPeriodSelect ? (
              <div className="mt-3">
                {isCoaching && selectedService && (
                  <p className="mb-2 text-xs font-medium text-zinc-500">
                    Step {servicePayOptions.length > 1 ? 3 : 2} ·{" "}
                    {selectionKind === "month" ? "Pick a month" : "Pick a week"}
                  </p>
                )}
                {slotsLoading ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />
                    ))}
                  </div>
                ) : periods.length === 0 ? (
                  <p className="text-sm text-zinc-600">
                    No upcoming {selectionKind === "month" ? "months" : "weeks"} available to enroll.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {periods.map((p) => {
                      const available = p.status === "available";
                      const picked = selectedSlot?.id === p.id;
                      const label =
                        periodCoverageLabel(p.periodKind, p.periodKey) || formatDayLabel(p.date);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={!available || Boolean(bookingId)}
                          onClick={() => available && setSelectedSlot(p)}
                          className={`rounded-lg border px-3 py-2.5 text-left transition disabled:cursor-default ${
                            picked
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                              : available
                                ? "border-white/10 bg-white/[0.03] text-zinc-200 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                : "border-white/5 bg-white/[0.01] text-zinc-600"
                          }`}
                        >
                          <span className="block text-sm font-semibold capitalize leading-tight">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-zinc-500">
                            {available
                              ? `₹${p.pricePerSlot.toLocaleString("en-IN")}${
                                  p.seatsLeft != null && p.maxParticipants
                                    ? ` · ${p.seatsLeft} seat${p.seatsLeft === 1 ? "" : "s"} left`
                                    : ""
                                }`
                              : "Full"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
            <>
            <div className={isService || business.setup.resources.length > 1 ? "mt-3" : ""}>
              {isCoaching && selectedService && (
                <p className="mb-2 text-xs font-medium text-zinc-500">
                  Step {servicePayOptions.length > 1 ? 3 : 2} ·{" "}
                  {selectionKind === "day"
                    ? "Pick a day"
                    : isBatchClass(selectedService)
                      ? "Pick your batch date & time"
                      : "Pick date & time"}
                </p>
              )}
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
              {multiSlotMode && !slotsLoading && availableDaySlots.length > 0 && (
                <p className="mt-1 text-xs text-emerald-300/80">
                  Tap multiple slots to book them together (e.g. 6–9) and pay once.
                </p>
              )}

              {slotsLoading ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
                  ))}
                </div>
              ) : daySlots.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">
                  {isCoaching && selectedService && isBatchClass(selectedService)
                    ? "No batch sessions on this day — try a day that matches the class schedule."
                    : "No slots on this day. Try another date."}
                </p>
              ) : wholeDayMode ? (
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
                        <span className="font-medium text-zinc-100">
                          {selectionKind === "day" ? "Whole day" : "Full day"}
                          {available && slot.seatsLeft != null && slot.maxParticipants
                            ? ` · ${slot.seatsLeft} seat${slot.seatsLeft === 1 ? "" : "s"} left`
                            : ""}
                        </span>
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
                    const picked = multiSlotMode
                      ? selectedSlots.some((s) => s.id === slot.id)
                      : selectedSlot?.id === slot.id;
                    const full = !available && slot.seatsLeft === 0;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={!available || Boolean(bookingId)}
                        onClick={() =>
                          available && (multiSlotMode ? toggleSlot(slot) : setSelectedSlot(slot))
                        }
                        title={`${formatTime12(slot.startTime)} – ${formatTime12(slot.endTime)} · ₹${slot.pricePerSlot.toLocaleString("en-IN")}${slot.pricingLabel ?? ""}`}
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
                        {slot.batchLabel && (
                          <span className="mt-0.5 block truncate text-[9px] text-zinc-500">
                            {slot.batchLabel}
                          </span>
                        )}
                        <span className="mt-0.5 block text-[10px] text-zinc-500">
                          {available
                            ? slot.seatsLeft != null && slot.maxParticipants
                              ? `${slot.seatsLeft} seat${slot.seatsLeft === 1 ? "" : "s"} · ₹${slot.pricePerSlot.toLocaleString("en-IN")}`
                              : `₹${slot.pricePerSlot.toLocaleString("en-IN")}`
                            : full
                              ? "Full"
                              : "Booked"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </>
            )}
            </>
            )}
          </div>

          {/* Multi-slot confirm bar (hourly resource bookings) */}
          {multiSlotMode && selectedSlotsSorted.length > 0 && (
            <div className="border-t border-white/8 bg-[#0c0c0e] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    {selectedSlotsSorted.length} slot{selectedSlotsSorted.length === 1 ? "" : "s"} selected
                  </p>
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {formatDayLabel(selectedSlotsSorted[0].date)}
                    {selectedResource ? ` · ${selectedResource.name}` : ""}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {selectedSlotsSorted
                      .map((s) => `${formatTime12(s.startTime)}–${formatTime12(s.endTime)}`)
                      .join(", ")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-300">
                    ₹{selectedSlotsTotal.toLocaleString("en-IN")}
                    <span className="ml-1 text-xs font-normal text-zinc-500">total</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlots([])}
                    className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={!canBook || Boolean(bookingId)}
                    onClick={() => void confirmBooking()}
                    className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                  >
                    {bookingId ? "Redirecting to pay…" : "Pay & book"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sticky confirm bar inside booking deck */}
          {!multiSlotMode && selectedSlot && selectedSlot.status === "available" && (
            <div className="border-t border-white/8 bg-[#0c0c0e] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">
                    {isCoaching
                      ? `Step ${servicePayOptions.length > 1 ? 4 : 3} · Confirm & pay`
                      : "Your selection"}
                  </p>
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {formatDayLabel(selectedSlot.date)}
                    {selectionKind === "time" && !isFullDay && ` · ${formatTime12(selectedSlot.startTime)}`}
                    {isService
                      ? selectedSlot.staffName
                        ? ` · ${selectedSlot.staffName}`
                        : ""
                      : selectedResource
                        ? ` · ${selectedResource.name}`
                        : ""}
                  </p>
                  {isService && (
                    <p className="truncate text-xs text-zinc-500">
                      {business.setup.services
                        .filter((s) => selectedServiceIds.includes(s.id))
                        .map((s) => s.name)
                        .join(", ")}
                      {isCoaching && isPeriodSelect && selectedSlot.periodKey
                        ? ` · ${periodCoverageLabel(selectedSlot.periodKind, selectedSlot.periodKey)}`
                        : ""}
                    </p>
                  )}
                  {isCoaching && selectedService ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-300">
                        {customerConfirmPaymentLine(
                          selectedSlot.pricePerSlot,
                          pricingModel || undefined,
                          selectedSlot.date,
                        ).title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {customerConfirmPaymentLine(
                          selectedSlot.pricePerSlot,
                          pricingModel || undefined,
                          selectedSlot.date,
                        ).detail}
                        {selectedSlot.seatsLeft != null && selectedSlot.maxParticipants
                          ? ` · ${selectedSlot.seatsLeft} seat${selectedSlot.seatsLeft === 1 ? "" : "s"} left`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-emerald-300">
                      ₹{selectedSlot.pricePerSlot.toLocaleString("en-IN")}
                      {selectedSlot.pricingLabel ?? ""}
                      {selectedSlot.seatsLeft != null && selectedSlot.maxParticipants
                        ? ` · ${selectedSlot.seatsLeft} seat${selectedSlot.seatsLeft === 1 ? "" : "s"} left`
                        : ""}
                    </p>
                  )}
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
                    {bookingId === selectedSlot.id
                      ? "Redirecting to pay…"
                      : isCoaching && (pricingModel === "monthly" || pricingModel === "weekly")
                        ? "Pay & enroll"
                        : "Pay & book"}
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
