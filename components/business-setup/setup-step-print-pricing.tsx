"use client";

import { useState } from "react";
import type { CategoryPricing, PrintCategory, PrintProfile } from "@/lib/api";
import { defaultCategoryPricing } from "@/lib/api";
import { pricingDimensions } from "@/lib/print-pricing";
import { usePrintCatalog } from "@/lib/swr-hooks";

type Props = {
  value: PrintProfile;
  onChange: (patch: Partial<PrintProfile>) => void;
};

const money = (n: number | undefined) =>
  typeof n === "number" && n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";

export function SetupStepPrintPricing({ value, onChange }: Props) {
  const { data: catalog = [], isLoading } = usePrintCatalog();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selected = catalog.filter((c) => value.serviceCategories.includes(c.id));

  function pricingFor(cat: PrintCategory): CategoryPricing {
    return value.pricing[cat.id] ?? defaultCategoryPricing(cat.pricingModel, cat.minQuantity);
  }

  function updateCat(cat: PrintCategory, patch: Partial<CategoryPricing>) {
    const current = pricingFor(cat);
    onChange({ pricing: { ...value.pricing, [cat.id]: { ...current, ...patch } } });
  }

  function updateAddonMap(cat: PrintCategory, dim: string, optionValue: string, amount: number) {
    const current = pricingFor(cat);
    const addons = { ...(current.addons ?? {}) };
    const map = { ...((addons as Record<string, Record<string, number>>)[dim] ?? {}) };
    if (amount > 0) map[optionValue] = amount;
    else delete map[optionValue];
    (addons as Record<string, unknown>)[dim] = map;
    updateCat(cat, { addons });
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-white/5" />;
  }

  if (selected.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-zinc-400">
          Pick the products you offer in the previous step, then set their prices here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-500">
        Set a price for every product. Customers see these prices and pay directly — no more quotes.
      </p>

      {selected.map((cat) => {
        const pricing = pricingFor(cat);
        const isOpen = expanded[cat.id] ?? false;
        const perPage = cat.pricingModel === "per_page";
        return (
          <div key={cat.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{cat.label}</p>
                  <p className="text-[11px] text-zinc-500">
                    {perPage ? "Priced per page" : "Priced per unit"}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <span>{pricing.enabled ? "Offered" : "Hidden"}</span>
                <input
                  type="checkbox"
                  checked={pricing.enabled}
                  onChange={(e) => updateCat(cat, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>
            </div>

            {pricing.enabled && (
              <div className="mt-4 space-y-4">
                {perPage ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MoneyField
                      label="Black & white (₹/page)"
                      value={pricing.perPage?.bw}
                      onChange={(n) =>
                        updateCat(cat, { perPage: { bw: n, color: pricing.perPage?.color ?? 0 } })
                      }
                    />
                    <MoneyField
                      label="Colour (₹/page)"
                      value={pricing.perPage?.color}
                      onChange={(n) =>
                        updateCat(cat, { perPage: { bw: pricing.perPage?.bw ?? 0, color: n } })
                      }
                    />
                  </div>
                ) : (
                  <MoneyField
                    label="Base price (₹ per unit)"
                    value={pricing.basePrice}
                    onChange={(n) => updateCat(cat, { basePrice: n })}
                  />
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField
                    label={perPage ? "Minimum copies" : "Minimum quantity"}
                    value={pricing.minQuantity}
                    min={1}
                    onChange={(n) => updateCat(cat, { minQuantity: Math.max(1, n) })}
                  />
                  <NumberField
                    label="Turnaround (days)"
                    value={pricing.turnaroundDays}
                    min={0}
                    onChange={(n) => updateCat(cat, { turnaroundDays: Math.max(0, n) })}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [cat.id]: !isOpen }))}
                  className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                >
                  {isOpen ? "Hide" : "Add"} option add-ons & bulk discounts (optional)
                </button>

                {isOpen && (
                  <div className="space-y-4 rounded-xl border border-white/8 bg-black/20 p-3">
                    {perPage ? (
                      <PerPageAddons
                        cat={cat}
                        pricing={pricing}
                        onDoubleSided={(n) =>
                          updateCat(cat, { addons: { ...(pricing.addons ?? {}), doubleSided: n } })
                        }
                        onAddonMap={updateAddonMap}
                      />
                    ) : (
                      <UnitAddons cat={cat} pricing={pricing} onAddonMap={updateAddonMap} />
                    )}

                    <TierEditor
                      perPage={perPage}
                      tiers={pricing.tiers ?? []}
                      onChange={(tiers) => updateCat(cat, { tiers })}
                    />
                  </div>
                )}

                <p className="text-xs text-zinc-500">
                  {perPage
                    ? `From ${money(pricing.perPage?.bw)} per B/W page`
                    : `From ${money(pricing.basePrice)} per unit`}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UnitAddons({
  cat,
  pricing,
  onAddonMap,
}: {
  cat: PrintCategory;
  pricing: CategoryPricing;
  onAddonMap: (cat: PrintCategory, dim: string, value: string, amount: number) => void;
}) {
  const dims = pricingDimensions(cat);
  if (!dims.length) return null;
  return (
    <div className="space-y-3">
      {dims.map((dim) => (
        <div key={dim.key}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {dim.label} add-on (₹)
          </p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {dim.values.map((v) => {
              const map = (pricing.addons as Record<string, Record<string, number>> | undefined)?.[
                dim.key
              ];
              return (
                <label key={v} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-zinc-400">{v}</span>
                  <input
                    type="number"
                    min={0}
                    value={map?.[v] || ""}
                    placeholder="+0"
                    onChange={(e) =>
                      onAddonMap(cat, dim.key, v, Math.max(0, Math.round(Number(e.target.value) || 0)))
                    }
                    className="field-input w-24 py-1.5 text-sm"
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PerPageAddons({
  cat,
  pricing,
  onDoubleSided,
  onAddonMap,
}: {
  cat: PrintCategory;
  pricing: CategoryPricing;
  onDoubleSided: (n: number) => void;
  onAddonMap: (cat: PrintCategory, dim: string, value: string, amount: number) => void;
}) {
  const bindingMap = pricing.addons?.binding;
  const paperSizeMap = pricing.addons?.paperSize;
  return (
    <div className="space-y-3">
      <MoneyField
        label="Double-sided add-on (₹/page)"
        value={pricing.addons?.doubleSided}
        onChange={onDoubleSided}
      />
      {cat.bindingOptions.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Binding price (₹)
          </p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {cat.bindingOptions.map((v) => (
              <label key={v} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-zinc-400">{v}</span>
                <input
                  type="number"
                  min={0}
                  value={bindingMap?.[v] || ""}
                  placeholder="+0"
                  onChange={(e) =>
                    onAddonMap(cat, "binding", v, Math.max(0, Math.round(Number(e.target.value) || 0)))
                  }
                  className="field-input w-24 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}
      {cat.sizes.length > 0 && (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Paper size add-on (₹/page)
          </p>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {cat.sizes.map((v) => (
              <label key={v} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-zinc-400">{v}</span>
                <input
                  type="number"
                  min={0}
                  value={paperSizeMap?.[v] || ""}
                  placeholder="+0"
                  onChange={(e) =>
                    onAddonMap(cat, "paperSize", v, Math.max(0, Math.round(Number(e.target.value) || 0)))
                  }
                  className="field-input w-24 py-1.5 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TierEditor({
  perPage,
  tiers,
  onChange,
}: {
  perPage: boolean;
  tiers: { minQty?: number; minPages?: number; unitPrice: number }[];
  onChange: (tiers: { minQty?: number; minPages?: number; unitPrice: number }[]) => void;
}) {
  const key = perPage ? "minPages" : "minQty";
  function update(i: number, patch: Partial<{ minQty: number; minPages: number; unitPrice: number }>) {
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Bulk discounts (optional)
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-600">
        {perPage
          ? "At or above this many pages, use this per-page rate."
          : "At or above this quantity, use this per-unit price."}
      </p>
      <div className="mt-2 space-y-2">
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              min={2}
              value={(perPage ? t.minPages : t.minQty) || ""}
              placeholder={perPage ? "Pages ≥" : "Qty ≥"}
              onChange={(e) => update(i, { [key]: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              className="field-input w-28 py-1.5 text-sm"
            />
            <span className="text-xs text-zinc-500">→</span>
            <input
              type="number"
              min={0}
              value={t.unitPrice || ""}
              placeholder={perPage ? "₹/page" : "₹/unit"}
              onChange={(e) => update(i, { unitPrice: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              className="field-input w-28 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(tiers.filter((_, idx) => idx !== i))}
              className="text-zinc-500 hover:text-red-300"
              aria-label="Remove tier"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...tiers, perPage ? { minPages: 0, unitPrice: 0 } : { minQty: 0, unitPrice: 0 }])}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
        >
          + Add tier
        </button>
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input
        type="number"
        min={0}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        className="field-input mt-1 w-full py-2 text-sm"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input
        type="number"
        min={min}
        value={value || ""}
        onChange={(e) => onChange(Math.round(Number(e.target.value) || 0))}
        className="field-input mt-1 w-full py-2 text-sm"
      />
    </label>
  );
}
