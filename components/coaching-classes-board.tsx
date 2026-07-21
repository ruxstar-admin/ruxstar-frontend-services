"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listBusinessSlots,
  listVendorBookings,
  type Business,
  type BusinessService,
  type BusinessSlot,
  type VendorBooking,
} from "@/lib/api";
import {
  formatEnrollmentLabel,
  formatMonthYear,
  formatServicePriceSummary,
  formatWeekRange,
  monthKeyFromDate,
  periodKindForModel,
  pricingModelCustomerLabel,
  servicePriceOptions,
  shiftMonthKey,
  shiftWeekKey,
  slotEnrolledCount,
  slotFillRatio,
  weekKeyFromDate,
  type PeriodKind,
} from "@/lib/coaching";
import {
  addDays,
  dayKeyForDate,
  formatDayLabel,
  formatTime12,
  todayLocal,
  dateRangeFrom,
} from "@/lib/date-utils";
import { SlotDateNav } from "@/components/slot-date-nav";

type Props = {
  business: Business;
};

function bookingMatchesSlot(booking: VendorBooking, slot: BusinessSlot, serviceId: string) {
  if (booking.status !== "confirmed") return false;
  if (booking.resourceId !== slot.resourceId) return false;
  const svcId = booking.services?.[0]?.id;
  if (svcId && svcId !== serviceId) return false;
  // Weekly/monthly enrollments pay once for the whole period, so every
  // session chip in that period shares the same roster rather than
  // matching one exact slot.
  if (booking.periodKind === "month") return booking.periodKey === monthKeyFromDate(slot.date);
  if (booking.periodKind === "week") return booking.periodKey === weekKeyFromDate(slot.date);
  return booking.startAt === slot.startAt;
}

function fillBarClass(ratio: number | null, full: boolean) {
  if (full) return "bg-sky-400";
  if (ratio == null) return "bg-emerald-400";
  if (ratio >= 1) return "bg-sky-400";
  if (ratio >= 0.75) return "bg-amber-400";
  return "bg-emerald-400";
}

function slotCardBorder(slot: BusinessSlot, isGroup: boolean) {
  if (!isGroup) {
    return slot.status === "booked"
      ? "border-sky-500/35 bg-sky-500/10"
      : "border-emerald-500/25 bg-emerald-500/5";
  }
  const ratio = slotFillRatio(slot);
  if (ratio != null && ratio >= 1) return "border-sky-500/35 bg-sky-500/10";
  if (ratio != null && ratio >= 0.5) return "border-amber-500/30 bg-amber-500/5";
  return "border-emerald-500/25 bg-emerald-500/5";
}

export function CoachingClassesBoard({ business }: Props) {
  const businessId = business.id;
  const services = business.setup?.services ?? [];
  const staff = business.setup?.staff ?? [];

  const [rangeStart, setRangeStart] = useState(todayLocal());
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [slots, setSlots] = useState<BusinessSlot[]>([]);
  const [bookings, setBookings] = useState<VendorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);

  const range = useMemo(() => dateRangeFrom(rangeStart), [rangeStart]);
  const today = todayLocal();
  const selectedService = services.find((s) => s.id === serviceId);
  const isGroupClass =
    Boolean(selectedService?.maxParticipants && selectedService.maxParticipants > 1) ||
    selectedService?.enrollmentType === "limited" ||
    selectedService?.enrollmentType === "batch" ||
    selectedService?.enrollmentType === "monthly";

  // A class can offer weekly AND monthly billing at once — the roster below
  // switches between them (whichever the vendor priced) with independent
  // week/month navigation.
  const periodKinds = useMemo(() => {
    if (!selectedService) return [];
    const kinds = new Set<PeriodKind>();
    for (const opt of servicePriceOptions(selectedService)) {
      const kind = periodKindForModel(opt.pricingModel);
      if (kind !== "exact") kinds.add(kind);
    }
    return [...kinds];
  }, [selectedService]);
  const [rosterKind, setRosterKind] = useState<PeriodKind>("month");
  const [rosterMonth, setRosterMonth] = useState(monthKeyFromDate(today));
  const [rosterWeek, setRosterWeek] = useState(weekKeyFromDate(today));

  useEffect(() => {
    if (services.length && !serviceId) setServiceId(services[0].id);
  }, [services, serviceId]);

  useEffect(() => {
    setRosterMonth(monthKeyFromDate(today));
    setRosterWeek(weekKeyFromDate(today));
    setRosterKind((prev) => (periodKinds.includes(prev) ? prev : periodKinds[0] ?? "month"));
  }, [serviceId, today, periodKinds]);

  useEffect(() => {
    if (today >= range.from && today <= range.to) setSelectedDate(today);
    else setSelectedDate(range.from);
    setExpandedSlotId(null);
  }, [range.from, range.to, today]);

  const load = useCallback(async () => {
    if (!serviceId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [slotRes, bookingList] = await Promise.all([
        listBusinessSlots(businessId, {
          from: range.from,
          to: range.to,
          serviceIds: [serviceId],
          staffId: staffId || undefined,
        }),
        listVendorBookings({ businessId }),
      ]);
      setSlots(slotRes.slots);
      setBookings(bookingList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load classes.");
    } finally {
      setLoading(false);
    }
  }, [businessId, range.from, range.to, serviceId, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  const datesInRange = useMemo(() => {
    const dates: string[] = [];
    let cursor = range.from;
    while (cursor <= range.to) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return dates;
  }, [range.from, range.to]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, BusinessSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots]);

  const daySlots = slotsByDate.get(selectedDate) ?? [];

  const bookingsBySlotId = useMemo(() => {
    const map = new Map<string, VendorBooking[]>();
    if (!serviceId) return map;
    for (const slot of slots) {
      const matched = bookings.filter((b) => bookingMatchesSlot(b, slot, serviceId));
      if (matched.length) map.set(slot.id, matched);
    }
    return map;
  }, [bookings, slots, serviceId]);

  const rosterKey = rosterKind === "week" ? rosterWeek : rosterMonth;
  const periodRoster = useMemo(() => {
    if (!periodKinds.length || !serviceId) return [];
    return bookings.filter(
      (b) =>
        b.status === "confirmed" &&
        b.periodKind === rosterKind &&
        b.periodKey === rosterKey &&
        (b.services?.[0]?.id ?? "") === serviceId &&
        (!staffId || b.resourceId === staffId),
    );
  }, [bookings, periodKinds, serviceId, rosterKind, rosterKey, staffId]);
  const rosterCapacity = selectedService?.maxParticipants ?? 0;

  const dayStats = useMemo(() => {
    let sessions = 0;
    let enrolled = 0;
    let capacity = 0;
    for (const slot of daySlots) {
      sessions += 1;
      const count = slotEnrolledCount(slot);
      if (isGroupClass && slot.maxParticipants) {
        enrolled += count ?? 0;
        capacity += slot.maxParticipants;
      } else if (slot.status === "booked") {
        enrolled += 1;
        capacity += 1;
      } else {
        capacity += 1;
      }
    }
    return { sessions, enrolled, capacity };
  }, [daySlots, isGroupClass]);

  const batchSummary = useMemo(() => {
    if (!selectedService?.classTimings?.length) return [];
    const weekday = dayKeyForDate(selectedDate);
    return selectedService.classTimings
      .filter((t) => t.day === weekday)
      .map((t) => {
        const matching = daySlots.filter(
          (s) =>
            s.startTime === t.startTime &&
            (t.batchLabel ? s.batchLabel === t.batchLabel : true),
        );
        let enrolled = 0;
        let cap = 0;
        for (const slot of matching) {
          enrolled += slotEnrolledCount(slot) ?? 0;
          cap += slot.maxParticipants ?? 1;
        }
        return { ...t, enrolled, capacity: cap, sessions: matching.length };
      });
  }, [selectedService, daySlots, selectedDate]);

  function renderServiceMeta(svc: BusinessService) {
    const enroll = formatEnrollmentLabel(svc.enrollmentType, svc.maxParticipants);
    const options = servicePriceOptions(svc);
    return (
      <span className="text-zinc-500">
        {options.length > 1
          ? options.map((o) => pricingModelCustomerLabel(o.pricingModel)).join(" · ")
          : formatServicePriceSummary(svc)}
        {enroll ? ` · ${enroll}` : ""}
      </span>
    );
  }

  return (
    <div className="glass flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 border-b border-white/8 bg-[#0c0c0e] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Classes & batches</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Seat counts and enrolled students per session
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="field-input min-w-[10rem] py-1.5 text-sm"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setExpandedSlotId(null);
            }}
          >
            {services.length === 0 && <option value="">No classes</option>}
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name}
              </option>
            ))}
          </select>
          <select
            className="field-input min-w-[9rem] py-1.5 text-sm"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setExpandedSlotId(null);
            }}
          >
            <option value="">All coaches</option>
            {staff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        {selectedService && (
          <p className="mt-2 text-xs">{renderServiceMeta(selectedService)}</p>
        )}

        {periodKinds.length > 0 && (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  rosterKind === "week"
                    ? setRosterWeek((w) => shiftWeekKey(w, -1))
                    : setRosterMonth((m) => shiftMonthKey(m, -1))
                }
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-xs text-zinc-400 hover:bg-white/5"
              >
                ‹
              </button>
              <p className="text-xs font-semibold text-emerald-200">
                {rosterKind === "week" ? "Weekly" : "Monthly"} roster ·{" "}
                {rosterKind === "week" ? formatWeekRange(rosterWeek) : formatMonthYear(`${rosterMonth}-01`)}
              </p>
              <button
                type="button"
                onClick={() =>
                  rosterKind === "week"
                    ? setRosterWeek((w) => shiftWeekKey(w, 1))
                    : setRosterMonth((m) => shiftMonthKey(m, 1))
                }
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-xs text-zinc-400 hover:bg-white/5"
              >
                ›
              </button>
            </div>
            {periodKinds.length > 1 && (
              <div className="mt-2 flex justify-center gap-1.5">
                {periodKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setRosterKind(kind)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                      rosterKind === kind
                        ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
                        : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {kind === "week" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-center text-[11px] text-zinc-500">
              {periodRoster.length}
              {rosterCapacity ? `/${rosterCapacity}` : ""} enrolled · covers every session on the
              schedule below this {rosterKind}
            </p>
            {periodRoster.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {periodRoster.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-zinc-200">
                      {b.customerName}
                      {b.customerMobile ? (
                        <span className="text-zinc-500"> · {b.customerMobile}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-medium text-zinc-400">
                      ₹{(b.amount ?? b.pricePerSlot).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3">
          <SlotDateNav
            rangeStart={range.from}
            rangeEnd={range.to}
            onRangeStartChange={setRangeStart}
          />
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {datesInRange.map((date) => {
            const count = (slotsByDate.get(date) ?? []).length;
            const active = selectedDate === date;
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setSelectedDate(date);
                  setExpandedSlotId(null);
                }}
                className={`rounded-lg px-1 py-1.5 text-[10px] font-medium transition sm:text-xs ${
                  active
                    ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
                    : "bg-white/5 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {date === today ? "Today" : formatDayLabel(date).split(",")[0]}
                {count > 0 && (
                  <span className="mt-0.5 block text-[9px] opacity-70">{count} slots</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 [scrollbar-width:thin]">
        {error && (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-zinc-300">
            {formatDayLabel(selectedDate)}
          </span>
          <span className="text-zinc-500">
            {dayStats.sessions} session{dayStats.sessions === 1 ? "" : "s"}
          </span>
          {isGroupClass ? (
            <span className="text-emerald-400/90">
              {dayStats.enrolled}/{dayStats.capacity} enrolled
            </span>
          ) : (
            <span className="text-sky-400/90">{dayStats.enrolled} booked</span>
          )}
        </div>

        {batchSummary.length > 0 && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Batch overview · {formatDayLabel(selectedDate)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {batchSummary.map((batch, i) => (
                <div
                  key={`${batch.day}-${batch.startTime}-${i}`}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <p className="font-medium text-zinc-200">
                    {batch.batchLabel || formatTime12(batch.startTime)}
                  </p>
                  <p className="mt-0.5 text-zinc-500">
                    {formatTime12(batch.startTime)}
                    {batch.endTime ? ` – ${formatTime12(batch.endTime)}` : ""}
                  </p>
                  <p className="mt-1 text-emerald-400/90">
                    {batch.enrolled}/{batch.capacity} enrolled
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : !serviceId ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-600">
            Add classes in setup to manage batches here.
          </p>
        ) : daySlots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-600">
            No sessions on this day. Pick another date or check class schedule in setup.
          </p>
        ) : (
          <div className="space-y-2">
            {daySlots.map((slot) => {
              const enrolled = slotEnrolledCount(slot);
              const capacity = slot.maxParticipants ?? 1;
              const ratio = slotFillRatio(slot);
              const full = isGroupClass
                ? (enrolled ?? 0) >= capacity
                : slot.status === "booked";
              const attendees = bookingsBySlotId.get(slot.id) ?? [];
              const expanded = expandedSlotId === slot.id;
              const soloBooking = !isGroupClass && attendees[0];

              return (
                <div
                  key={slot.id}
                  className={`rounded-xl border px-4 py-3 transition ${slotCardBorder(slot, isGroupClass)}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedSlotId(expanded ? null : slot.id)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">
                        {formatTime12(slot.startTime)}
                        {slot.endTime ? ` – ${formatTime12(slot.endTime)}` : ""}
                      </p>
                      {slot.batchLabel && (
                        <p className="mt-0.5 text-xs font-medium text-emerald-400/80">
                          {slot.batchLabel}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {slot.staffName || slot.resourceName || "Coach"}
                        {slot.pricingLabel
                          ? ` · ₹${slot.pricePerSlot.toLocaleString("en-IN")}${slot.pricingLabel}`
                          : ` · ₹${slot.pricePerSlot.toLocaleString("en-IN")}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {isGroupClass ? (
                        <>
                          <p
                            className={`text-sm font-semibold ${full ? "text-sky-300" : "text-emerald-300"}`}
                          >
                            {enrolled ?? 0}/{capacity}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {full ? "Full" : `${slot.seatsLeft ?? 0} seats left`}
                          </p>
                        </>
                      ) : (
                        <p
                          className={`text-xs font-medium ${full ? "text-sky-300" : "text-emerald-400/90"}`}
                        >
                          {full ? "Booked" : "Open"}
                        </p>
                      )}
                    </div>
                  </button>

                  {isGroupClass && (
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${fillBarClass(ratio, full)}`}
                        style={{ width: `${Math.round((ratio ?? 0) * 100)}%` }}
                      />
                    </div>
                  )}

                  {expanded && (
                    <div className="mt-3 border-t border-white/8 pt-3">
                      {attendees.length === 0 ? (
                        <p className="text-xs text-zinc-600">
                          {full && !isGroupClass && soloBooking
                            ? "Booking details unavailable."
                            : "No paid enrollments yet."}
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {attendees.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs"
                            >
                              <span className="min-w-0 truncate text-zinc-200">
                                {b.customerName}
                                {b.customerMobile ? (
                                  <span className="text-zinc-500"> · {b.customerMobile}</span>
                                ) : null}
                              </span>
                              <span className="shrink-0 font-medium text-zinc-400">
                                ₹{(b.amount ?? b.pricePerSlot).toLocaleString("en-IN")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-[10px] text-zinc-600">
                        Tap session to collapse · Paid bookings only
                      </p>
                    </div>
                  )}

                  {!expanded && attendees.length > 0 && isGroupClass && (
                    <p className="mt-2 truncate text-[11px] text-zinc-500">
                      {attendees.map((b) => b.customerName).join(", ")}
                    </p>
                  )}

                  {!expanded && soloBooking && (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {soloBooking.customerName}
                      {soloBooking.customerMobile ? ` · ${soloBooking.customerMobile}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
