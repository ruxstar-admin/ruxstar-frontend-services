"use client";

import { useState } from "react";
import type { BusinessService, BusinessStaff } from "@/lib/api";

const input = "field-input";

type Props = {
  services: BusinessService[];
  staff: BusinessStaff[];
  onAdd: (service: { name: string; durationMinutes: number; price: number }) => void;
  onRemove: (id: string) => void;
  onToggleStaff: (serviceId: string, staffId: string) => void;
};

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];

export function SetupStepServices({ services, staff, onAdd, onRemove, onToggleStaff }: Props) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = price.trim() ? Math.round(Number(price)) : NaN;
    if (!Number.isFinite(p) || p < 0) return;
    onAdd({ name: trimmed, durationMinutes: duration, price: p });
    setName("");
    setPrice("");
    setDuration(30);
  }

  const noStaff = staff.length === 0;

  return (
    <div>
      <p className="text-sm font-medium text-zinc-200">What customers book</p>
      <p className="mt-1 text-sm text-zinc-500">
        Add each service with how long it takes and its price.
      </p>

      {noStaff && (
        <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          Add staff first — every service needs at least one person assigned.
        </p>
      )}

      <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <input
          className={input}
          placeholder="Service name (e.g. Haircut)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className={`${input} flex-1`}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
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
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={noStaff}
          className="btn-primary w-full rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          Add service
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {services.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-600">
            No services yet.
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
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {svc.durationMinutes} min · ₹{svc.price.toLocaleString("en-IN")}
                  </p>
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
                    Who performs this
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
