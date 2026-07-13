"use client";

import { useMemo, useState } from "react";
import type { PrintCategory, PrintOrderAttributes, PrintShop } from "@/lib/api";
import {
  computePrice,
  pricingDimensions,
  type PriceSelection,
  type PrintOrderDraft,
} from "@/lib/print-pricing";
import { categoryRequirements } from "@/lib/print-requirements";
import { compressImageForUpload } from "@/lib/compress-image";

const input = "field-input";
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

type Section = { id: string; pages: string; color: "bw" | "color" };

export function PrintConfigurator({
  category,
  shop,
  city,
  onBack,
  onCheckout,
}: {
  category: PrintCategory;
  shop: PrintShop;
  city: string;
  onBack: () => void;
  onCheckout: (draft: PrintOrderDraft) => void;
}) {
  const perPage = category.pricingModel === "per_page";
  const minQty = Math.max(1, shop.minQuantity || category.minQuantity || 1);

  const [notes, setNotes] = useState("");
  const [designImage, setDesignImage] = useState("");
  const [designFileName, setDesignFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // per_unit state
  const dims = useMemo(() => pricingDimensions(category), [category]);
  const [quantity, setQuantity] = useState(String(minQty));
  const [options, setOptions] = useState<Record<string, string>>({});
  const [unitMode, setUnitMode] = useState<"guided" | "upload">("guided");
  const extraFields = useMemo(
    () => categoryRequirements(category).filter((f) => f.type === "text" || f.type === "textarea"),
    [category],
  );
  const [extras, setExtras] = useState<Record<string, string>>({});

  // per_page state
  const [copies, setCopies] = useState(String(minQty));
  const [pageMode, setPageMode] = useState<"simple" | "sections">("simple");
  const [simplePages, setSimplePages] = useState("");
  const [simpleColor, setSimpleColor] = useState<"bw" | "color">("bw");
  const [sections, setSections] = useState<Section[]>([
    { id: crypto.randomUUID(), pages: "", color: "bw" },
  ]);
  const [doubleSided, setDoubleSided] = useState(false);
  const [binding, setBinding] = useState("");
  const [paperSize, setPaperSize] = useState("");

  const selection: PriceSelection = perPage
    ? {
        copies: Math.max(0, Math.round(Number(copies) || 0)),
        sections: (pageMode === "simple"
          ? [{ pages: Math.round(Number(simplePages) || 0), color: simpleColor }]
          : sections.map((s) => ({ pages: Math.round(Number(s.pages) || 0), color: s.color }))
        ).filter((s) => s.pages > 0),
        doubleSided,
        binding: binding || undefined,
        paperSize: paperSize || undefined,
      }
    : { quantity: Math.max(0, Math.round(Number(quantity) || 0)), options };

  const price = computePrice(category, shop.pricing, selection);

  const bindingOptions = category.bindingOptions;
  const sizeOptions = category.sizes;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      if (file.type.startsWith("image/")) {
        setDesignImage(await compressImageForUpload(file));
      } else {
        if (file.size > 8 * 1024 * 1024) throw new Error("File too large (max 8MB).");
        setDesignImage(await readAsDataUrl(file));
      }
      setDesignFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function validate(): string | null {
    if (perPage) {
      const qty = Math.round(Number(copies) || 0);
      if (qty < minQty) return `Minimum ${minQty} cop${minQty === 1 ? "y" : "ies"}.`;
      const pages = (selection.sections ?? []).reduce((sum, s) => sum + s.pages, 0);
      if (pages <= 0) return "Enter the number of pages to print.";
    } else {
      const qty = Math.round(Number(quantity) || 0);
      if (qty < minQty) return `Minimum quantity is ${minQty}.`;
      for (const field of categoryRequirements(category)) {
        if (!field.required) continue;
        if (["size", "material", "printType", "color"].includes(field.key)) {
          if (unitMode === "upload" && field.key !== "size") continue;
          if (!options[field.key]) return `Select ${field.label.toLowerCase()}.`;
        }
      }
    }
    if (price.total <= 0) return "This configuration has no price. Adjust your options.";
    return null;
  }

  function buildAttributes(): PrintOrderAttributes {
    if (perPage) {
      const pages = (selection.sections ?? []).reduce((sum, s) => sum + s.pages, 0);
      const hasColor = (selection.sections ?? []).some((s) => s.color === "color");
      const extrasOut: Record<string, string> = {
        pages: String(pages),
        colorMode: hasColor ? "colour" : "black & white",
        copies: String(Math.round(Number(copies) || 0)),
      };
      if (doubleSided) extrasOut.doubleSided = "yes";
      if (binding) extrasOut.binding = binding;
      if (paperSize) extrasOut.paperSize = paperSize;
      return { extras: extrasOut };
    }
    const attrs: PrintOrderAttributes = {};
    if (options.size) attrs.size = options.size;
    if (options.material) attrs.material = options.material;
    if (options.printType) attrs.printType = options.printType;
    if (options.color) attrs.color = options.color;
    const extrasOut: Record<string, string> = {};
    if (options.sides) extrasOut.sides = options.sides;
    for (const [k, v] of Object.entries(extras)) {
      if (v.trim()) extrasOut[k] = v.trim();
    }
    if (Object.keys(extrasOut).length) attrs.extras = extrasOut;
    return attrs;
  }

  function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    onCheckout({
      category,
      shop,
      city,
      quantity: perPage
        ? Math.round(Number(copies) || 0)
        : Math.round(Number(quantity) || 0),
      selection,
      attributes: buildAttributes(),
      notes: notes.trim(),
      designImage: designImage || undefined,
      designFileName: designFileName || undefined,
      price,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/5 px-4 py-4 sm:px-6">
        <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to shops
        </button>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-2xl">
            {category.icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-zinc-100">{category.label}</h2>
            <p className="truncate text-xs text-zinc-500">
              {shop.name}
              {shop.turnaroundDays > 0 ? ` · ~${shop.turnaroundDays} day turnaround` : ""}
            </p>
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-100">
            {error}
          </p>
        )}
      </div>

      <div className="scroll-pane min-h-0 flex-1 space-y-5 px-4 py-5 sm:px-6">
        {perPage ? (
          <PerPageForm
            copies={copies}
            minQty={minQty}
            onCopies={setCopies}
            pageMode={pageMode}
            onPageMode={setPageMode}
            simplePages={simplePages}
            onSimplePages={setSimplePages}
            simpleColor={simpleColor}
            onSimpleColor={setSimpleColor}
            sections={sections}
            onSections={setSections}
            doubleSided={doubleSided}
            onDoubleSided={setDoubleSided}
            binding={binding}
            onBinding={setBinding}
            bindingOptions={bindingOptions}
            paperSize={paperSize}
            onPaperSize={setPaperSize}
            sizeOptions={sizeOptions}
          />
        ) : (
          <UnitForm
            minQty={minQty}
            quantity={quantity}
            onQuantity={setQuantity}
            dims={dims}
            options={options}
            onOption={(k, v) => setOptions((prev) => ({ ...prev, [k]: v }))}
            mode={unitMode}
            onMode={setUnitMode}
            extraFields={extraFields}
            extras={extras}
            onExtra={(k, v) => setExtras((prev) => ({ ...prev, [k]: v }))}
          />
        )}

        {/* Artwork / file upload — available for both flows */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-sm text-zinc-300">
            {perPage ? "Upload document (PDF or image)" : "Upload artwork"}
            <span className="text-zinc-600"> (optional)</span>
          </p>
          <div className="mt-3 flex items-center gap-3">
            {designImage ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className="text-lg">📎</span>
                <span className="max-w-[12rem] truncate text-sm text-zinc-300">
                  {designFileName || "Uploaded file"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDesignImage("");
                    setDesignFileName("");
                  }}
                  className="text-zinc-500 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex h-16 w-full max-w-xs cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-zinc-500 hover:border-white/30 hover:text-zinc-300">
                {uploading ? "Uploading…" : "+ Upload file"}
                <input
                  type="file"
                  accept={perPage ? "application/pdf,image/*" : "image/*"}
                  className="hidden"
                  onChange={onPickFile}
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        <label className="block text-sm text-zinc-400">
          Notes <span className="text-zinc-600">(optional)</span>
          <textarea
            className={`${input} mt-1.5 min-h-[70px] py-2.5 text-sm`}
            value={notes}
            placeholder="Any special instructions for the shop…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="shrink-0 border-t border-white/5 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-600">Total</p>
            <p className="text-2xl font-semibold text-emerald-300">
              {price.total > 0 ? money(price.total) : "—"}
            </p>
            {perPage && price.totalPages ? (
              <p className="text-[11px] text-zinc-600">
                {price.totalPages} pages ×{" "}
                {Math.round(Number(copies) || 0)} cop{Number(copies) === 1 ? "y" : "ies"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={uploading || price.total <= 0}
            onClick={submit}
            className="btn-primary shrink-0 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Review &amp; pay
          </button>
        </div>
      </div>
    </div>
  );
}

function UnitForm({
  minQty,
  quantity,
  onQuantity,
  dims,
  options,
  onOption,
  mode,
  onMode,
  extraFields,
  extras,
  onExtra,
}: {
  minQty: number;
  quantity: string;
  onQuantity: (v: string) => void;
  dims: { key: string; label: string; values: string[] }[];
  options: Record<string, string>;
  onOption: (key: string, value: string) => void;
  mode: "guided" | "upload";
  onMode: (m: "guided" | "upload") => void;
  extraFields: { key: string; label: string; type: string; placeholder?: string; hint?: string }[];
  extras: Record<string, string>;
  onExtra: (key: string, value: string) => void;
}) {
  // In "upload" mode we only keep size (needed for pricing); everything else is
  // conveyed via the uploaded artwork.
  const shownDims = mode === "upload" ? dims.filter((d) => d.key === "size" || d.key === "sides") : dims;
  return (
    <div className="space-y-4">
      <label className="block text-sm text-zinc-400">
        Quantity <span className="text-zinc-300">*</span>
        <input
          type="number"
          min={minQty}
          className={`${input} mt-1.5 w-40 py-2.5 text-sm`}
          value={quantity}
          onChange={(e) => onQuantity(e.target.value)}
        />
        {minQty > 1 && <span className="mt-0.5 block text-xs text-zinc-600">Minimum {minQty}</span>}
      </label>

      <Segmented
        value={mode}
        onChange={(v) => onMode(v as "guided" | "upload")}
        options={[
          { value: "guided", label: "Choose options" },
          { value: "upload", label: "Upload artwork" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {shownDims.map((dim) => (
          <label key={dim.key} className="block text-sm text-zinc-400">
            {dim.label}
            <select
              className={`${input} mt-1.5 py-2.5 text-sm`}
              value={options[dim.key] ?? ""}
              onChange={(e) => onOption(dim.key, e.target.value)}
            >
              <option value="">Select…</option>
              {dim.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {mode === "guided" && extraFields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {extraFields.map((f) =>
            f.type === "textarea" ? (
              <label key={f.key} className="block text-sm text-zinc-400 sm:col-span-2">
                {f.label}
                <textarea
                  className={`${input} mt-1.5 min-h-[70px] py-2.5 text-sm`}
                  value={extras[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => onExtra(f.key, e.target.value)}
                />
              </label>
            ) : (
              <label key={f.key} className="block text-sm text-zinc-400">
                {f.label}
                <input
                  className={`${input} mt-1.5 py-2.5 text-sm`}
                  value={extras[f.key] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => onExtra(f.key, e.target.value)}
                />
              </label>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function PerPageForm({
  copies,
  minQty,
  onCopies,
  pageMode,
  onPageMode,
  simplePages,
  onSimplePages,
  simpleColor,
  onSimpleColor,
  sections,
  onSections,
  doubleSided,
  onDoubleSided,
  binding,
  onBinding,
  bindingOptions,
  paperSize,
  onPaperSize,
  sizeOptions,
}: {
  copies: string;
  minQty: number;
  onCopies: (v: string) => void;
  pageMode: "simple" | "sections";
  onPageMode: (m: "simple" | "sections") => void;
  simplePages: string;
  onSimplePages: (v: string) => void;
  simpleColor: "bw" | "color";
  onSimpleColor: (c: "bw" | "color") => void;
  sections: Section[];
  onSections: (s: Section[]) => void;
  doubleSided: boolean;
  onDoubleSided: (v: boolean) => void;
  binding: string;
  onBinding: (v: string) => void;
  bindingOptions: string[];
  paperSize: string;
  onPaperSize: (v: string) => void;
  sizeOptions: string[];
}) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-zinc-400">
        Copies <span className="text-zinc-300">*</span>
        <input
          type="number"
          min={minQty}
          className={`${input} mt-1.5 w-40 py-2.5 text-sm`}
          value={copies}
          onChange={(e) => onCopies(e.target.value)}
        />
      </label>

      <Segmented
        value={pageMode}
        onChange={(v) => onPageMode(v as "simple" | "sections")}
        options={[
          { value: "simple", label: "All pages same" },
          { value: "sections", label: "By section" },
        ]}
      />

      {pageMode === "simple" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400">
            Number of pages <span className="text-zinc-300">*</span>
            <input
              type="number"
              min={1}
              className={`${input} mt-1.5 py-2.5 text-sm`}
              value={simplePages}
              onChange={(e) => onSimplePages(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-400">
            Print colour
            <select
              className={`${input} mt-1.5 py-2.5 text-sm`}
              value={simpleColor}
              onChange={(e) => onSimpleColor(e.target.value as "bw" | "color")}
            >
              <option value="bw">Black &amp; white</option>
              <option value="color">Colour</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Page groups (e.g. cover in colour, body in B/W)
          </p>
          {sections.map((sec, i) => (
            <div key={sec.id} className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Pages"
                className={`${input} w-28 py-2 text-sm`}
                value={sec.pages}
                onChange={(e) =>
                  onSections(sections.map((s) => (s.id === sec.id ? { ...s, pages: e.target.value } : s)))
                }
              />
              <select
                className={`${input} flex-1 py-2 text-sm`}
                value={sec.color}
                onChange={(e) =>
                  onSections(
                    sections.map((s) =>
                      s.id === sec.id ? { ...s, color: e.target.value as "bw" | "color" } : s,
                    ),
                  )
                }
              >
                <option value="bw">Black &amp; white</option>
                <option value="color">Colour</option>
              </select>
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSections(sections.filter((s) => s.id !== sec.id))}
                  className="text-zinc-500 hover:text-red-300"
                  aria-label={`Remove group ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onSections([...sections, { id: crypto.randomUUID(), pages: "", color: "bw" }])
            }
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            + Add group
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={doubleSided}
            onChange={(e) => onDoubleSided(e.target.checked)}
            className="h-4 w-4 accent-emerald-500"
          />
          Double-sided
        </label>
        {sizeOptions.length > 0 && (
          <label className="block text-sm text-zinc-400">
            Paper size
            <select
              className={`${input} mt-1.5 py-2.5 text-sm`}
              value={paperSize}
              onChange={(e) => onPaperSize(e.target.value)}
            >
              <option value="">Standard</option>
              {sizeOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        {bindingOptions.length > 0 && (
          <label className="block text-sm text-zinc-400">
            Binding
            <select
              className={`${input} mt-1.5 py-2.5 text-sm`}
              value={binding}
              onChange={(e) => onBinding(e.target.value)}
            >
              <option value="">None</option>
              {bindingOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-white/10 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 transition ${
            value === o.value ? "bg-white/10 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
