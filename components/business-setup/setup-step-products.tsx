"use client";

import { useEffect, useRef, useState } from "react";
import {
  createCommerceProduct,
  deleteCommerceProduct,
  listVendorCommerceProducts,
  updateCommerceProduct,
  type CommerceProduct,
} from "@/lib/api";

const input = "field-input";

type Props = {
  businessId: string;
  onCountChange?: (count: number) => void;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("could not read image"));
    reader.readAsDataURL(file);
  });
}

export function SetupStepProducts({ businessId, onCountChange }: Props) {
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [images, setImages] = useState<string[]>([]);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listVendorCommerceProducts(businessId);
      setProducts(list);
      setStockEdits({});
      onCountChange?.(list.filter((p) => p.active).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function onPickImages(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    for (const file of Array.from(files).slice(0, 3 - next.length)) {
      if (!file.type.startsWith("image/")) continue;
      next.push(await fileToDataUrl(file));
    }
    setImages(next.slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function addProduct() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a product name.");
      return;
    }
    const p = Math.round(Number(price));
    if (!Number.isFinite(p) || p < 1) {
      setError("Price must be at least ₹1.");
      return;
    }
    if (!stock.trim()) {
      setError("Enter how many you have in stock.");
      return;
    }
    const s = Math.round(Number(stock));
    if (!Number.isFinite(s) || s < 0) {
      setError("Stock must be 0 or more.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createCommerceProduct(businessId, {
        name: trimmed,
        description: description.trim(),
        price: p,
        stock: s,
        images,
      });
      setName("");
      setDescription("");
      setPrice("");
      setStock("10");
      setImages([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add product");
    } finally {
      setBusy(false);
    }
  }

  async function saveStock(product: CommerceProduct) {
    const raw = stockEdits[product.id];
    if (raw === undefined) return;
    const next = Math.round(Number(raw));
    if (!raw.trim() || !Number.isFinite(next) || next < 0) {
      setError("Stock must be 0 or more.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateCommerceProduct(businessId, product.id, { stock: next });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update stock");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(id: string) {
    setBusy(true);
    setError("");
    try {
      await deleteCommerceProduct(businessId, id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-zinc-200">Your products</p>
        <p className="mt-1 text-sm text-zinc-500">
          Add each item with price and stock. Customers order from this list — update stock here
          whenever you restock.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <input
          className={input}
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className={`${input} min-h-[3.5rem] resize-none`}
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              ₹
            </span>
            <input
              className={`${input} pl-7`}
              inputMode="numeric"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <input
            className={input}
            inputMode="numeric"
            placeholder="Stock"
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void onPickImages(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3 || busy}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
          >
            Add photos ({images.length}/3)
          </button>
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              className="relative h-10 w-10 overflow-hidden rounded-lg border border-white/10"
              title="Remove photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void addProduct()}
          className="btn-primary mt-1 w-full rounded-full py-2 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add product"}
        </button>
      </div>

      {loading ? (
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
      ) : products.length === 0 ? (
        <p className="text-sm text-zinc-500">No products yet — add at least one to go live.</p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => {
            const draft = stockEdits[p.id];
            const dirty = draft !== undefined && draft !== String(p.stock);
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                  {p.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-zinc-600">—</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    ₹{p.price.toLocaleString("en-IN")}
                    {!p.active ? " · hidden" : ""}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <label className="text-[11px] text-zinc-500" htmlFor={`stock-${p.id}`}>
                      Stock
                    </label>
                    <input
                      id={`stock-${p.id}`}
                      className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-100"
                      inputMode="numeric"
                      value={draft ?? String(p.stock)}
                      onChange={(e) =>
                        setStockEdits((prev) => ({
                          ...prev,
                          [p.id]: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                    {dirty && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveStock(p)}
                        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 disabled:opacity-50"
                      >
                        Save
                      </button>
                    )}
                    {!dirty && p.stock === 0 && (
                      <span className="text-[11px] text-amber-200">
                        Out of stock — customers can see it but cannot buy it
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeProduct(p.id)}
                  className="shrink-0 self-start rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:text-red-200 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
