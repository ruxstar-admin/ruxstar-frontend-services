"use client";

import { useState } from "react";
import type { BusinessService, BusinessStaff, DayKey, PriceOption } from "@/lib/api";
import {
  DAY_OPTIONS,
  ENROLLMENT_OPTIONS,
  VENDOR_PRICING_MODELS,
  enrollmentNeedsCapacity,
  enrollmentNeedsTimings,
  formatPriceOption,
  servicePriceOptions,
  type ClassTiming,
  type EnrollmentType,
  type PricingModel,
} from "@/lib/coaching";

const input = "field-input";

type NewService = {
  name: string;
  durationMinutes: number;
  price: number;
  pricingModel: PricingModel;
  enrollmentType: EnrollmentType;
  maxParticipants: number;
  classTimings: ClassTiming[];
  priceOptions: PriceOption[];
};

type Props = {
  services: BusinessService[];
  staff: BusinessStaff[];
  onAdd: (service: NewService) => void;
  onRemove: (id: string) => void;
  onToggleStaff: (serviceId: string, staffId: string) => void;
};

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180];

const defaultTiming = (): ClassTiming => ({ day: "mon", startTime: "09:00", endTime: "10:00" });

type PriceRow = { pricingModel: PricingModel; price: string; pickTime?: boolean };

const defaultPriceRows = (): PriceRow[] => [{ pricingModel: "daily", price: "", pickTime: false }];

const pricePlaceholder = (model: PricingModel): string => {
  if (model === "hourly") return "Price / hour";
  if (model === "weekly") return "Price / week";
  if (model === "monthly") return "Price / month";
  return "Price / day";
};

export function SetupStepCoachingServices({
  services,
  staff,
  onAdd,
  onRemove,
  onToggleStaff,
}: Props) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [priceRows, setPriceRows] = useState<PriceRow[]>(defaultPriceRows());
  const [enrollmentType, setEnrollmentType] = useState<EnrollmentType>("open");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [classTimings, setClassTimings] = useState<ClassTiming[]>([defaultTiming()]);
  const [formError, setFormError] = useState("");

  const showTimings = enrollmentNeedsTimings(enrollmentType);
  // Every payment type is available on any class — a weekly/monthly pass just
  // grants access for that period, with or without a fixed schedule.
  const availableModels = VENDOR_PRICING_MODELS;

  function addTimingRow() {
    setClassTimings((prev) => [...prev, defaultTiming()]);
  }

  function updateTiming(index: number, patch: Partial<ClassTiming>) {
    setClassTimings((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeTiming(index: number) {
    setClassTimings((prev) => prev.filter((_, i) => i !== index));
  }

  function addPriceRow() {
    const used = new Set(priceRows.map((r) => r.pricingModel));
    const next = availableModels.find((o) => !used.has(o.value));
    if (!next) return;
    setPriceRows((prev) => [...prev, { pricingModel: next.value, price: "" }]);
  }

  function updatePriceRow(index: number, patch: Partial<PriceRow>) {
    setFormError("");
    setPriceRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removePriceRow(index: number) {
    setPriceRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function resetForm() {
    setName("");
    setDuration(60);
    setPriceRows(defaultPriceRows());
    setEnrollmentType("open");
    setMaxParticipants("10");
    setClassTimings([defaultTiming()]);
  }

  function add() {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Enter a class name.");
      return;
    }
    if (noStaff) {
      setFormError("Add a coach first — every class needs at least one coach.");
      return;
    }

    const priceOptions: PriceOption[] = [];
    for (const row of priceRows) {
      const p = row.price.trim() ? Math.round(Number(row.price)) : NaN;
      if (!Number.isFinite(p) || p < 0) {
        setFormError("Enter a valid price for every payment option.");
        return;
      }
      priceOptions.push({
        pricingModel: row.pricingModel,
        price: p,
        ...(row.pricingModel === "daily" && row.pickTime ? { pickTime: true } : {}),
      });
    }
    if (!priceOptions.length) {
      setFormError("Add at least one payment option.");
      return;
    }

    const cap = enrollmentNeedsCapacity(enrollmentType)
      ? Math.max(1, Math.round(Number(maxParticipants) || 10))
      : 1;
    if (enrollmentNeedsTimings(enrollmentType) && classTimings.length === 0) {
      setFormError("Add at least one class timing for this enrollment type.");
      return;
    }

    setFormError("");
    onAdd({
      name: trimmed,
      durationMinutes: duration,
      price: priceOptions[0].price,
      pricingModel: priceOptions[0].pricingModel,
      enrollmentType,
      maxParticipants: cap,
      classTimings: enrollmentNeedsTimings(enrollmentType) ? classTimings : [],
      priceOptions,
    });
    resetForm();
  }

  const noStaff = staff.length === 0;
  const showCapacity = enrollmentNeedsCapacity(enrollmentType);
  const usedModels = new Set(priceRows.map((r) => r.pricingModel));
  const canAddMoreOptions = availableModels.some((o) => !usedModels.has(o.value));

  return (
    <div>
      <p className="text-sm font-medium text-zinc-200">Classes & sessions</p>
      <p className="mt-1 text-sm text-zinc-500">
        Offer one class under several payment types — hourly, daily, weekly, or monthly — each
        with its own price. Customers pick which one works for them at booking.
      </p>

      {noStaff && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          Add coaches first — every class needs at least one coach assigned.
        </p>
      )}

      <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        {/* ── 1 · Class details ── */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            1 · Class details
          </p>
          <input
            className={input}
            placeholder="Class name (e.g. Kuchipudi Dance)"
            value={name}
            onChange={(e) => {
              setFormError("");
              setName(e.target.value);
            }}
          />
          <label className="flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span>Session length</span>
            <select
              className={`${input} w-32`}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ── 2 · Pricing ── */}
        <div className="space-y-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                2 · How you charge
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Add every option you want to offer. You set each price.
              </p>
            </div>
            {canAddMoreOptions && (
              <button
                type="button"
                onClick={addPriceRow}
                className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                + Add
              </button>
            )}
          </div>
          {priceRows.map((row, i) => {
            const hint = availableModels.find((o) => o.value === row.pricingModel)?.hint;
            return (
              <div key={i} className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex gap-2">
                  <select
                    className={`${input} w-32 shrink-0`}
                    value={row.pricingModel}
                    onChange={(e) => updatePriceRow(i, { pricingModel: e.target.value as PricingModel })}
                  >
                    {availableModels.map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                        disabled={usedModels.has(o.value) && o.value !== row.pricingModel}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      ₹
                    </span>
                    <input
                      className={`${input} w-full pl-7`}
                      type="number"
                      min={0}
                      placeholder={pricePlaceholder(row.pricingModel)}
                      value={row.price}
                      onChange={(e) => updatePriceRow(i, { price: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
                    />
                  </div>
                  {priceRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePriceRow(i)}
                      aria-label="Remove option"
                      className="shrink-0 rounded-lg px-2 text-xs text-zinc-500 hover:bg-white/5 hover:text-red-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {hint && <p className="pl-0.5 text-[11px] text-zinc-500">{hint}</p>}
                {row.pricingModel === "daily" && (
                  <label className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-emerald-500"
                      checked={row.pickTime ?? false}
                      onChange={(e) => updatePriceRow(i, { pickTime: e.target.checked })}
                    />
                    Customer picks a time that day (off = books the whole day)
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 3 · Seats & schedule (optional) ── */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            3 · Seats &amp; schedule
            <span className="ml-1 font-normal normal-case text-zinc-600">· optional</span>
          </p>
          <label className="block text-xs text-zinc-500">
            Enrollment type
            <select
              className={`${input} mt-1 w-full`}
              value={enrollmentType}
              onChange={(e) => setEnrollmentType(e.target.value as EnrollmentType)}
            >
              {ENROLLMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-zinc-600">
            {ENROLLMENT_OPTIONS.find((o) => o.value === enrollmentType)?.hint}
          </p>

          {showCapacity && (
            <label className="block text-xs text-zinc-500">
              Max people per slot
              <input
                className={`${input} mt-1 w-full`}
                type="number"
                min={1}
                max={500}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </label>
          )}

          {showTimings && (
            <div className="space-y-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">Class schedule</p>
                <button
                  type="button"
                  onClick={addTimingRow}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  + Add timing
                </button>
              </div>
              {classTimings.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <select
                    className={`${input} text-sm`}
                    value={row.day}
                    onChange={(e) => updateTiming(i, { day: e.target.value as DayKey })}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${input} text-sm`}
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateTiming(i, { startTime: e.target.value })}
                  />
                  <input
                    className={`${input} text-sm`}
                    type="time"
                    value={row.endTime ?? ""}
                    onChange={(e) => updateTiming(i, { endTime: e.target.value })}
                  />
                  <input
                    className={`${input} col-span-2 text-sm sm:col-span-1`}
                    placeholder="Batch label"
                    value={row.batchLabel ?? ""}
                    onChange={(e) => updateTiming(i, { batchLabel: e.target.value })}
                  />
                  {classTimings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTiming(i)}
                      className="text-xs text-zinc-500 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {formError && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {formError}
          </p>
        )}

        <button
          type="button"
          onClick={add}
          disabled={noStaff}
          className="btn-primary w-full rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Add class
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-600">
            No classes yet.
          </p>
        ) : (
          services.map((svc) => (
            <div
              key={svc.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{svc.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{svc.durationMinutes} min</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {servicePriceOptions(svc).map((opt) => (
                      <span
                        key={opt.pricingModel}
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200"
                      >
                        {formatPriceOption(opt, svc.durationMinutes)}
                      </span>
                    ))}
                  </div>
                  {(svc.enrollmentType && svc.enrollmentType !== "open") || (svc.maxParticipants ?? 0) > 1 ? (
                    <p className="mt-1.5 text-[11px] text-emerald-400/80">
                      {svc.enrollmentType === "batch"
                        ? "Batch-wise"
                        : svc.enrollmentType === "monthly"
                          ? "Monthly"
                          : svc.enrollmentType === "limited"
                            ? `Limited · ${svc.maxParticipants} seats`
                            : ""}
                      {svc.classTimings?.length
                        ? ` · ${svc.classTimings.map((t) => `${t.day} ${t.startTime}${t.batchLabel ? ` (${t.batchLabel})` : ""}`).join(", ")}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(svc.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/5 hover:text-red-300"
                >
                  Remove
                </button>
              </div>

              {staff.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                    Coaches
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {staff.map((st) => {
                      const on = svc.staffIds.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => onToggleStaff(svc.id, st.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            on
                              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
                              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20"
                          }`}
                        >
                          {st.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
