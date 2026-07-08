"use client";

import { useState } from "react";
import type { PrintProfile } from "@/lib/api";
import { prettyCity } from "@/lib/cities";
import { usePlaceSearch } from "@/lib/location-search";
import { usePrintCatalog } from "@/lib/swr-hooks";

type Props = {
  value: PrintProfile;
  onChange: (patch: Partial<PrintProfile>) => void;
};

export function SetupStepPrintProfile({ value, onChange }: Props) {
  const { data: categories = [], isLoading } = usePrintCatalog();
  const [cityInput, setCityInput] = useState("");
  const [cityFocus, setCityFocus] = useState(false);
  const { suggestions: citySuggestions, loading: cityLoading } = usePlaceSearch(
    cityInput,
    cityFocus && !value.serveAll,
  );

  function toggleCategory(id: string) {
    const has = value.serviceCategories.includes(id);
    onChange({
      serviceCategories: has
        ? value.serviceCategories.filter((c) => c !== id)
        : [...value.serviceCategories, id],
    });
  }

  function addCity(raw?: string) {
    const key = (raw ?? cityInput).trim().toLowerCase();
    if (!key) return;
    if (!value.cities.includes(key)) onChange({ cities: [...value.cities, key] });
    setCityInput("");
    setCityFocus(false);
  }

  function removeCity(city: string) {
    onChange({ cities: value.cities.filter((c) => c !== city) });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-zinc-200">What do you print?</p>
        <p className="mt-1 text-xs text-zinc-500">
          Only orders in these categories will reach you.
        </p>
        {isLoading ? (
          <div className="mt-3 h-24 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => {
              const selected = value.serviceCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Serve everywhere</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Accept orders from any city (deliver pan-India).
            </p>
          </div>
          <input
            type="checkbox"
            checked={value.serveAll}
            onChange={(e) => onChange({ serveAll: e.target.checked })}
            className="h-5 w-5 accent-emerald-500"
          />
        </label>

        {!value.serveAll && (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-400">Cities you serve</p>

            {value.cities.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {value.cities.map((city) => (
                  <span
                    key={city}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium capitalize text-emerald-200"
                  >
                    {prettyCity(city)}
                    <button
                      type="button"
                      onClick={() => removeCity(city)}
                      className="text-emerald-300/70 hover:text-emerald-100"
                      aria-label={`Remove ${city}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mt-3">
              <div className="flex gap-2">
                <input
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onFocus={() => setCityFocus(true)}
                  onBlur={() => setTimeout(() => setCityFocus(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCity();
                    }
                  }}
                  placeholder="Type a city, town or village…"
                  className="field-input w-full py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => addCity()}
                  disabled={!cityInput.trim()}
                  className="shrink-0 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {cityFocus && cityInput.trim().length > 0 && (
                <ul className="scroll-pane absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c0e] p-1 shadow-2xl">
                  {citySuggestions
                    .filter((s) => !value.cities.includes(s.value))
                    .map((s) => (
                      <li key={s.value}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addCity(s.value);
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
                        >
                          <span className="text-sm text-zinc-200">{s.label}</span>
                          {s.sublabel && (
                            <span className="block truncate text-xs text-zinc-500">{s.sublabel}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  {citySuggestions.filter((s) => !value.cities.includes(s.value)).length === 0 && (
                    <li className="px-3 py-2 text-xs text-zinc-500">
                      {cityLoading
                        ? "Searching…"
                        : cityInput.trim().length < 3
                          ? "Type at least 3 letters to search towns & villages."
                          : "No match — tap Add to use what you typed."}
                    </li>
                  )}
                </ul>
              )}
            </div>
            <p className="mt-1.5 text-xs text-zinc-600">
              Search and pick a city, town or village — it's added instantly.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Typical turnaround (days)</span>
          <input
            type="number"
            min={0}
            value={value.turnaroundDays || ""}
            onChange={(e) => onChange({ turnaroundDays: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            className="field-input mt-1 w-full py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-400">Minimum order value (₹)</span>
          <input
            type="number"
            min={0}
            value={value.minOrderValue || ""}
            onChange={(e) => onChange({ minOrderValue: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
            className="field-input mt-1 w-full py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-zinc-400">Notes for customers (optional)</span>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value.slice(0, 1000) })}
          rows={3}
          placeholder="e.g. Bulk discounts available. Design help offered."
          className="field-input mt-1 w-full py-2 text-sm"
        />
      </label>
    </div>
  );
}
