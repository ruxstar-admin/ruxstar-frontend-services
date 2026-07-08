"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createPrintOrder,
  type PrintCategory,
  type PrintOrderAttributes,
  type PrintRequirementField,
} from "@/lib/api";
import { usePlaceSearch } from "@/lib/location-search";
import { compressImageForUpload } from "@/lib/compress-image";
import {
  categoryCardMeta,
  categoryRequirements,
  categorySearchText,
  isSelectRequirement,
  notesPlaceholder,
  requirementOptions,
} from "@/lib/print-requirements";
import { invalidateMyPrintOrders, usePrintCatalog } from "@/lib/swr-hooks";

const input = "field-input";

const PAGE_HEADER =
  "shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const PAGE_FOOTER =
  "shrink-0 border-t border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const SCROLL_BODY = "scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8";

export default function CustomerPrintPage() {
  const router = useRouter();
  const { data: catalog = [], isLoading: catalogLoading } = usePrintCatalog(true);
  const [selected, setSelected] = useState<PrintCategory | null>(null);
  const [query, setQuery] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((cat) => categorySearchText(cat).includes(q));
  }, [catalog, query]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      {selected ? (
        <OrderForm
          category={selected}
          onBack={() => setSelected(null)}
          onPlaced={() => router.push("/customer/orders")}
        />
      ) : (
        <>
          <div className={PAGE_HEADER}>
            <div className="flex items-start gap-4">
              <span
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-4xl sm:h-[4.5rem] sm:w-[4.5rem] sm:text-5xl"
                aria-hidden
              >
                🖨️
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h1 className="text-2xl font-semibold sm:text-3xl">
                    <span className="text-gradient">Print on demand</span>
                  </h1>
                  {!catalogLoading && catalog.length > 0 && (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                      {catalog.length} services
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Search and order — vendors near you send competitive quotes.
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search t-shirts, banners, cards, stickers, documents…"
                className={`${input} w-full py-3 pr-10 text-sm`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
            </div>
            {query.trim() && !catalogLoading && (
              <p className="mt-2 text-xs text-zinc-500">
                {filteredCatalog.length} match{filteredCatalog.length === 1 ? "" : "es"} for &ldquo;{query.trim()}&rdquo;
              </p>
            )}
          </div>

          <div className={SCROLL_BODY}>
            <ServiceCatalog
              catalog={filteredCatalog}
              loading={catalogLoading}
              query={query}
              onClearSearch={() => setQuery("")}
              onSelect={setSelected}
            />
          </div>
        </>
      )}
    </section>
  );
}

function ServiceCatalog({
  catalog,
  loading,
  query,
  onClearSearch,
  onSelect,
}: {
  catalog: PrintCategory[];
  loading: boolean;
  query: string;
  onClearSearch: () => void;
  onSelect: (cat: PrintCategory) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-h-[14rem] animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (catalog.length === 0 && !loading) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
        <div>
          <p className="text-4xl">{query.trim() ? "🔍" : "🖨️"}</p>
          <p className="mt-3 text-sm text-zinc-400">
            {query.trim()
              ? `No services match "${query.trim()}". Try banners, cards, or apparel.`
              : "Print catalog is not available right now."}
          </p>
          {query.trim() && (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-3 text-sm text-zinc-500 hover:text-zinc-300"
            >
              Clear search
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {catalog.map((cat) => {
        const meta = categoryCardMeta(cat);
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat)}
            className="group flex flex-col rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-[2.75rem] leading-none transition group-hover:bg-white/10 sm:h-20 sm:w-20 sm:text-5xl">
                {cat.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">{cat.label}</h3>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                    {meta.minQtyLabel}
                  </span>
                </div>
                {cat.description && (
                  <p className="mt-1 text-sm text-zinc-500">{cat.description}</p>
                )}
                <p className="mt-1.5 text-xs text-zinc-600">{meta.useCase}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 border-t border-white/5 pt-4 text-xs">
              {meta.sizePreview && (
                <div>
                  <span className="font-medium text-zinc-500">Sizes </span>
                  <span className="text-zinc-400">{meta.sizePreview}</span>
                </div>
              )}
              {meta.printPreview && (
                <div>
                  <span className="font-medium text-zinc-500">Print </span>
                  <span className="text-zinc-400">{meta.printPreview}</span>
                </div>
              )}
              {meta.materialPreview && (
                <div>
                  <span className="font-medium text-zinc-500">Materials </span>
                  <span className="text-zinc-400">{meta.materialPreview}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-zinc-500">
                  ⏱ {meta.turnaround}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-zinc-500">
                  {meta.optionCount} options
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-xs text-zinc-600">Free quotes from nearby vendors</span>
              <span className="text-xs font-medium text-zinc-400 transition group-hover:text-zinc-200">
                Start order →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CityCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const { suggestions, loading } = usePlaceSearch(value, focus);

  return (
    <div className="relative mt-1.5">
      <input
        className={`${input} w-full py-2.5 text-sm`}
        value={value}
        placeholder="City, town or village…"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
      />
      {focus && value.trim().length > 0 && (
        <ul className="scroll-pane absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c0e] p-1 shadow-2xl">
          {suggestions.map((s) => (
            <li key={s.value}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.label);
                  setFocus(false);
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
          {suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-500">
              {loading
                ? "Searching…"
                : value.trim().length < 3
                  ? "Type at least 3 letters…"
                  : "No match — you can still use what you typed."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function RequirementFieldInput({
  field,
  category,
  value,
  onChange,
  designImage,
  uploading,
  onPickImage,
  onClearDesign,
}: {
  field: PrintRequirementField;
  category: PrintCategory;
  value: string;
  onChange: (v: string) => void;
  designImage?: string;
  uploading?: boolean;
  onPickImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearDesign?: () => void;
}) {
  const label = (
    <>
      {field.label}
      {field.required && <span className="text-zinc-300"> *</span>}
    </>
  );

  if (field.type === "file" || field.key === "designImage") {
    return (
      <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <span className="text-sm text-zinc-400">{label}</span>
        {field.hint && <p className="mt-1 text-xs text-zinc-600">{field.hint}</p>}
        <div className="mt-3 flex items-center gap-4">
          {designImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={designImage}
                alt="Upload"
                className="h-24 w-24 rounded-xl border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={onClearDesign}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/80 text-xs text-zinc-300 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex h-24 w-full max-w-xs cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-zinc-500 hover:border-white/30 hover:text-zinc-300">
              {uploading ? "Uploading…" : "+ Upload file"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickImage}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block text-sm text-zinc-400 sm:col-span-2">
        {label}
        {field.hint && <span className="mt-0.5 block text-xs text-zinc-600">{field.hint}</span>}
        <textarea
          className={`${input} mt-1.5 min-h-[80px] py-2.5 text-sm`}
          value={value}
          required={field.required}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "select" || isSelectRequirement(field)) {
    const options = requirementOptions(category, field.key);
    if (options.length === 0) return null;
    return (
      <label className="block text-sm text-zinc-400">
        {label}
        {field.hint && <span className="mt-0.5 block text-xs text-zinc-600">{field.hint}</span>}
        <select
          className={`${input} mt-1.5 py-2.5 text-sm`}
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{field.required ? "Select…" : "Any / not sure"}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block text-sm text-zinc-400">
      {label}
      {field.hint && <span className="mt-0.5 block text-xs text-zinc-600">{field.hint}</span>}
      <input
        className={`${input} mt-1.5 py-2.5 text-sm`}
        value={value}
        required={field.required}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function OrderForm({
  category,
  onBack,
  onPlaced,
}: {
  category: PrintCategory;
  onBack: () => void;
  onPlaced: () => void;
}) {
  const requirements = categoryRequirements(category);

  const [quantity, setQuantity] = useState(String(category.minQuantity || 1));
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");
  const [selects, setSelects] = useState<Record<string, string>>({
    size: "",
    material: "",
    printType: "",
    color: "",
  });
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [designImage, setDesignImage] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function fieldValue(field: PrintRequirementField): string {
    if (field.type === "file" || field.key === "designImage") return designImage;
    if (isSelectRequirement(field)) return selects[field.key] ?? "";
    return extras[field.key] ?? "";
  }

  function setFieldValue(field: PrintRequirementField, value: string) {
    if (isSelectRequirement(field)) {
      setSelects((prev) => ({ ...prev, [field.key]: value }));
    } else if (field.type !== "file" && field.key !== "designImage") {
      setExtras((prev) => ({ ...prev, [field.key]: value }));
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = await compressImageForUpload(file);
      setDesignImage(data);
    } catch {
      setError("Could not read that image.");
    } finally {
      setUploading(false);
    }
  }

  function validateRequirements(): string | null {
    for (const field of requirements) {
      if (!field.required) continue;
      if (field.type === "file" || field.key === "designImage") {
        if (!designImage) return `${field.label} is required.`;
        continue;
      }
      if (!fieldValue(field).trim()) return `${field.label} is required.`;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const qty = Math.round(Number(quantity));
    if (!Number.isFinite(qty) || qty < (category.minQuantity || 1)) {
      setError(`Minimum quantity is ${category.minQuantity || 1}.`);
      return;
    }
    if (!city.trim()) {
      setError("Please enter your city so we can match nearby vendors.");
      return;
    }
    const reqError = validateRequirements();
    if (reqError) {
      setError(reqError);
      return;
    }

    const attributes: PrintOrderAttributes = {};
    if (selects.size) attributes.size = selects.size;
    if (selects.material) attributes.material = selects.material;
    if (selects.printType) attributes.printType = selects.printType;
    if (selects.color) attributes.color = selects.color;
    const extraEntries: Record<string, string> = {};
    for (const field of requirements) {
      if (field.type === "file" || field.key === "designImage" || isSelectRequirement(field)) continue;
      const v = extras[field.key]?.trim();
      if (v) extraEntries[field.key] = v;
    }
    if (Object.keys(extraEntries).length) attributes.extras = extraEntries;

    setBusy(true);
    try {
      await createPrintOrder({
        categoryId: category.id,
        quantity: qty,
        city: city.trim(),
        pincode: pincode.trim() || undefined,
        notes: notes.trim() || undefined,
        attributes,
        designImage: designImage || undefined,
      });
      await invalidateMyPrintOrders();
      onPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place your order.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className={PAGE_HEADER}>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          ← All products
        </button>

        <div className="mt-3 flex items-center gap-4">
          <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-5xl leading-none sm:h-20 sm:w-20">
            {category.icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-100">{category.label}</h2>
            {category.description && (
              <p className="mt-0.5 text-sm text-zinc-500">{category.description}</p>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        )}
      </div>

      <div className={`${SCROLL_BODY} lg:grid lg:grid-cols-[minmax(220px,280px)_1fr] lg:gap-8 lg:overflow-hidden`}>
        <aside className="mb-4 hidden shrink-0 lg:block">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Requirements
          </p>
          <ul className="mt-3 space-y-2">
            {requirements.map((field) => (
              <li
                key={field.key}
                className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs"
              >
                <span className={field.required ? "text-zinc-200" : "text-zinc-600"}>
                  {field.required ? "●" : "○"}
                </span>
                <div>
                  <p className="text-zinc-300">{field.label}</p>
                  {field.hint && <p className="mt-0.5 text-[10px] text-zinc-600">{field.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <div className="scroll-pane min-h-0 lg:overflow-y-auto">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-wide text-zinc-500 lg:hidden">
            Order details
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm text-zinc-400">
              Quantity <span className="text-zinc-300">*</span>
              <input
                type="number"
                min={category.minQuantity || 1}
                className={`${input} mt-1.5 py-2.5 text-sm`}
                value={quantity}
                required
                onChange={(e) => setQuantity(e.target.value)}
              />
              {category.minQuantity > 1 && (
                <span className="mt-0.5 block text-xs text-zinc-600">
                  Minimum {category.minQuantity}
                </span>
              )}
            </label>
            <label className="block text-sm text-zinc-400 sm:col-span-2 xl:col-span-1">
              Delivery city <span className="text-zinc-300">*</span>
              <CityCombobox value={city} onChange={setCity} />
            </label>

            {requirements.map((field) => (
              <RequirementFieldInput
                key={field.key}
                field={field}
                category={category}
                value={field.type === "file" || field.key === "designImage" ? designImage : fieldValue(field)}
                onChange={(v) => setFieldValue(field, v)}
                designImage={designImage}
                uploading={uploading}
                onPickImage={onPickImage}
                onClearDesign={() => setDesignImage("")}
              />
            ))}

            <label className="block text-sm text-zinc-400">
              Pincode <span className="text-zinc-600">(optional)</span>
              <input
                className={`${input} mt-1.5 py-2.5 text-sm`}
                value={pincode}
                inputMode="numeric"
                onChange={(e) => setPincode(e.target.value)}
              />
            </label>
          </div>

          <label className="mt-4 block text-sm text-zinc-400">
            Notes <span className="text-zinc-600">(optional)</span>
            <textarea
              className={`${input} mt-1.5 min-h-[80px] py-2.5 text-sm`}
              value={notes}
              placeholder={notesPlaceholder(category)}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className={PAGE_FOOTER}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-600">
            Vendors send quotes — you only pay after you accept one.
          </p>
          <button
            type="submit"
            disabled={busy || uploading}
            className="btn-primary w-full shrink-0 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-60 sm:w-auto"
          >
            {busy ? "Placing order…" : "Find a vendor"}
          </button>
        </div>
      </div>
    </form>
  );
}
