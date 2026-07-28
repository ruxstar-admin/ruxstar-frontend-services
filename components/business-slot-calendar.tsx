"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  blockBusinessSlot,
  clearBusinessSlotPrice,
  listBusinessSlots,
  setBusinessSlotPrice,
  type BusinessSlot,
  type BusinessSlotsResponse,
  unblockBusinessSlot,
} from "@/lib/api";
import { addDays, formatDayLabel, formatTime12, todayLocal, dateRangeFrom } from "@/lib/date-utils";
import { SlotDateNav } from "@/components/slot-date-nav";

const STATUS_STYLES: Record<string, string> = {
  available:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/50",
  demand: "border-amber-500/40 bg-amber-500/10 text-amber-100 hover:border-amber-400/50",
  blocked: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300 hover:border-zinc-400/50",
  booked: "border-sky-500/30 bg-sky-500/10 text-sky-100 opacity-80",
  unavailable: "border-white/10 bg-white/[0.03] text-zinc-600",
};

type CalendarMode = "block" | "price";

type Props = {
  businessId: string;
  businessName: string;
};

function slotBasePrice(slot: BusinessSlot, fallback: number) {
  return slot.basePricePerSlot ?? fallback;
}

function isDemandPriced(slot: BusinessSlot, base: number) {
  return slot.status === "available" && slot.pricePerSlot > base;
}

function shortDayTab(dateStr: string, today: string) {
  const d = dateStr === today ? "Today" : formatDayLabel(dateStr).replace(/,/g, "");
  return d;
}

export function BusinessSlotCalendar({ businessId, businessName }: Props) {
  const [rangeStart, setRangeStart] = useState(todayLocal());
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [resourceId, setResourceId] = useState<string>("");
  const [mode, setMode] = useState<CalendarMode>("block");
  const [data, setData] = useState<BusinessSlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [priceEdit, setPriceEdit] = useState<BusinessSlot | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const range = useMemo(() => dateRangeFrom(rangeStart), [rangeStart]);
  const resources = data?.resources ?? [];
  const selectedResource = resources.find((r) => r.id === resourceId);
  const basePrice = selectedResource?.pricePerSlot ?? data?.pricePerSlot ?? 0;
  const isFullDay = data?.bookingMode === "fullDay";
  const today = todayLocal();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listBusinessSlots(businessId, {
        from: range.from,
        to: range.to,
        resourceId: resourceId || undefined,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load slots.");
    } finally {
      setLoading(false);
    }
  }, [businessId, range.from, range.to, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (today >= range.from && today <= range.to) {
      setSelectedDate(today);
    } else {
      setSelectedDate(range.from);
    }
  }, [range.from, range.to, today]);

  useEffect(() => {
    if (resources.length > 0 && !resourceId) {
      setResourceId(resources[0].id);
    }
  }, [resources, resourceId]);

  const slotsGrouped = useMemo(() => {
    const byDate = new Map<string, Map<string, BusinessSlot[]>>();
    for (const slot of data?.slots ?? []) {
      if (!byDate.has(slot.date)) byDate.set(slot.date, new Map());
      const byRes = byDate.get(slot.date)!;
      const list = byRes.get(slot.resourceId) ?? [];
      list.push(slot);
      byRes.set(slot.resourceId, list);
    }
    for (const byRes of byDate.values()) {
      for (const list of byRes.values()) {
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    }
    return byDate;
  }, [data?.slots]);

  function getResourceSlots(date: string, resId: string) {
    return slotsGrouped.get(date)?.get(resId) ?? [];
  }

  const datesInRange = useMemo(() => {
    const dates: string[] = [];
    let cursor = range.from;
    while (cursor <= range.to) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return dates;
  }, [range.from, range.to]);

  const visibleResources = resourceId
    ? resources.filter((r) => r.id === resourceId)
    : resources;

  function patchSlot(slot: BusinessSlot, patch: Partial<BusinessSlot>) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slots: prev.slots.map((s) => (s.id === slot.id ? { ...s, ...patch } : s)),
      };
    });
  }

  async function toggleSlot(slot: BusinessSlot) {
    if (slot.status === "booked") return;
    setBusyId(slot.id);
    setError("");
    const nextStatus = slot.status === "blocked" ? "available" : "blocked";
    try {
      if (slot.status === "blocked") {
        await unblockBusinessSlot(businessId, {
          resourceId: slot.resourceId,
          startAt: slot.startAt,
        });
      } else {
        await blockBusinessSlot(businessId, {
          resourceId: slot.resourceId,
          startAt: slot.startAt,
          endAt: slot.endAt,
        });
      }
      patchSlot(slot, { status: nextStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update slot.");
    } finally {
      setBusyId("");
    }
  }

  function openPriceEdit(slot: BusinessSlot) {
    setPriceEdit(slot);
    setPriceInput(String(slot.pricePerSlot));
    setError("");
  }

  async function saveDemandPrice() {
    if (!priceEdit) return;
    const price = Number(priceInput);
    const base = slotBasePrice(priceEdit, basePrice);
    if (!Number.isFinite(price) || price < base) {
      setError(`Demand price must be at least ₹${base}.`);
      return;
    }
    setBusyId(priceEdit.id);
    setError("");
    try {
      await setBusinessSlotPrice(businessId, {
        resourceId: priceEdit.resourceId,
        startAt: priceEdit.startAt,
        pricePerSlot: Math.round(price),
      });
      patchSlot(priceEdit, {
        pricePerSlot: Math.round(price),
        basePricePerSlot: base,
      });
      setPriceEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set demand price.");
    } finally {
      setBusyId("");
    }
  }

  async function resetDemandPrice() {
    if (!priceEdit) return;
    setBusyId(priceEdit.id);
    setError("");
    const base = slotBasePrice(priceEdit, basePrice);
    try {
      await clearBusinessSlotPrice(businessId, {
        resourceId: priceEdit.resourceId,
        startAt: priceEdit.startAt,
      });
      patchSlot(priceEdit, { pricePerSlot: base, basePricePerSlot: undefined });
      setPriceEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset price.");
    } finally {
      setBusyId("");
    }
  }

  function onSlotClick(slot: BusinessSlot) {
    if (slot.status === "booked" || busyId === slot.id) return;
    if (mode === "price") {
      if (slot.status === "available") openPriceEdit(slot);
      return;
    }
    toggleSlot(slot);
  }

  const dayStats = useMemo(() => {
    let available = 0;
    let blocked = 0;
    let booked = 0;
    let demand = 0;
    for (const resource of visibleResources) {
      for (const s of getResourceSlots(selectedDate, resource.id)) {
        if (s.status === "available") {
          available += 1;
          if (isDemandPriced(s, slotBasePrice(s, basePrice))) demand += 1;
        } else if (s.status === "blocked") blocked += 1;
        else if (s.status === "booked") booked += 1;
      }
    }
    return { available, blocked, booked, demand };
  }, [visibleResources, selectedDate, slotsGrouped, basePrice]);

  function slotStyle(slot: BusinessSlot) {
    if (slot.status === "available" && isDemandPriced(slot, slotBasePrice(slot, basePrice))) {
      return STATUS_STYLES.demand;
    }
    return STATUS_STYLES[slot.status] ?? STATUS_STYLES.unavailable;
  }

  function renderSlotChip(slot: BusinessSlot) {
    const base = slotBasePrice(slot, basePrice);
    const demand = isDemandPriced(slot, base);
    const clickable = slot.status !== "booked";
    return (
      <button
        key={slot.id}
        type="button"
        disabled={!clickable || busyId === slot.id}
        onClick={() => onSlotClick(slot)}
        title={
          slot.status === "booked" && slot.booking?.customerName
            ? slot.booking.customerName
            : undefined
        }
        className={`rounded-lg border px-2 py-1.5 text-left text-xs transition disabled:opacity-60 ${
          clickable ? "cursor-pointer" : "cursor-default"
        } ${slotStyle(slot)}`}
      >
        <span className="block font-medium leading-tight">
          {isFullDay ? "Full day" : formatTime12(slot.startTime)}
        </span>
        <span className="mt-0.5 block text-[10px] opacity-75">
          {slot.status === "available" && (demand ? `₹${slot.pricePerSlot} ↑` : `₹${slot.pricePerSlot}`)}
          {slot.status === "blocked" && "Blocked"}
          {slot.status === "booked" && "Booked"}
        </span>
      </button>
    );
  }

  const dayHasSlots = visibleResources.some((r) => getResourceSlots(selectedDate, r.id).length > 0);

  return (
    <div className="glass flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 border-b border-white/5 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{businessName}</h2>
            <p className="text-xs text-zinc-500">
              {data
                ? isFullDay
                  ? selectedResource
                    ? `Full-day · ${selectedResource.name} · base ₹${basePrice}/day`
                    : `Full-day booking · from ₹${basePrice}/day`
                  : selectedResource
                    ? `${data.slotMinutes} min · ${selectedResource.name} · base ₹${basePrice}`
                    : `${data.slotMinutes} min · from ₹${basePrice}`
                : "Loading…"}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <SlotDateNav
            rangeStart={range.from}
            rangeEnd={range.to}
            onRangeStartChange={setRangeStart}
          />
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {datesInRange.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => {
                setSelectedDate(date);
                setPriceEdit(null);
              }}
              className={`rounded-lg px-1 py-1.5 text-[10px] font-medium transition sm:px-2.5 sm:text-xs ${
                selectedDate === date
                  ? "bg-white/15 text-zinc-100"
                  : "bg-white/5 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {shortDayTab(date, today)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("block");
              setPriceEdit(null);
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              mode === "block" ? "bg-white/15 text-zinc-100" : "bg-white/5 text-zinc-500"
            }`}
          >
            Block
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("price");
              setPriceEdit(null);
            }}
            className={`rounded-full px-3 py-1 text-xs ${
              mode === "price" ? "bg-amber-500/20 text-amber-200" : "bg-white/5 text-zinc-500"
            }`}
          >
            Demand price
          </button>
          <span className="hidden h-4 w-px bg-white/10 sm:block" />
          {resources.length > 1 &&
            resources.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setResourceId(r.id);
                  setPriceEdit(null);
                }}
                className={`rounded-full px-3 py-1 text-xs ${
                  resourceId === r.id ? "bg-white/15 text-zinc-100" : "bg-white/5 text-zinc-500"
                }`}
              >
                {r.name}
              </button>
            ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        {error && (
          <p className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        )}

        {priceEdit && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
            <span className="text-xs text-zinc-300">
              {priceEdit.resourceName} · {formatTime12(priceEdit.startTime)}
            </span>
            <div className="relative w-24">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                ₹
              </span>
              <input
                className="field-input py-1.5 pl-6 text-xs"
                inputMode="numeric"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <button
              type="button"
              disabled={busyId === priceEdit.id}
              onClick={saveDemandPrice}
              className="btn-primary rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Save
            </button>
            {priceEdit.pricePerSlot > slotBasePrice(priceEdit, basePrice) && (
              <button
                type="button"
                disabled={busyId === priceEdit.id}
                onClick={resetDemandPrice}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setPriceEdit(null)}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-zinc-500">
          <span className="text-emerald-400/90">{dayStats.available} open</span>
          <span className="text-amber-400/90">{dayStats.demand} surge</span>
          <span>{dayStats.blocked} blocked</span>
          <span className="text-sky-400/90">{dayStats.booked} booked</span>
          <span className="text-zinc-600">
            · {mode === "block" ? "Tap to block/unblock" : "Tap to set surge price"}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : !dayHasSlots ? (
          <p className="py-6 text-center text-sm text-zinc-600">No slots this day — closed or past hours.</p>
        ) : (
          <div className="space-y-3">
            {visibleResources.map((resource) => {
              const slots = getResourceSlots(selectedDate, resource.id);
              if (!slots.length) return null;
              return (
                <div key={resource.id}>
                  {resources.length > 1 && (
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {resource.name}
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {slots.map((slot) => renderSlotChip(slot))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
