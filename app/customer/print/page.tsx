"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPrintOrder, payPrintOrder, type PrintCategory, type PrintShop } from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";
import { detectCurrentCity, usePlaceSearch } from "@/lib/location-search";
import type { PrintOrderDraft } from "@/lib/print-pricing";
import { categoryCardMeta, categorySearchText } from "@/lib/print-requirements";
import {
  invalidateMyPrintOrders,
  useAvailablePrintShops,
  usePrintCatalog,
} from "@/lib/swr-hooks";
import { PrintShopList } from "@/components/print/print-shop-list";
import { PrintConfigurator } from "@/components/print/print-configurator";

const input = "field-input";

const PAGE_HEADER =
  "shrink-0 border-b border-white/5 bg-[#0a0a0b]/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8";

const SCROLL_BODY = "scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function CustomerPrintPage() {
  const { data: catalog = [], isLoading: catalogLoading } = usePrintCatalog(true);
  const [selected, setSelected] = useState<PrintCategory | null>(null);
  const [shop, setShop] = useState<PrintShop | null>(null);
  const [city, setCity] = useState("");
  const [draft, setDraft] = useState<PrintOrderDraft | null>(null);
  const [query, setQuery] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((cat) => categorySearchText(cat).includes(q));
  }, [catalog, query]);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function handlePay(d: PrintOrderDraft) {
    setPaying(true);
    setPayError("");
    try {
      const order = await createPrintOrder({
        businessId: d.shop.businessId,
        categoryId: d.category.id,
        selection: d.selection,
        city: d.city,
        notes: d.notes || undefined,
        attributes: d.attributes,
        designImage: d.designImage,
      });
      invalidateMyPrintOrders();
      const { payment } = await payPrintOrder(order.id);
      // Redirects away to Cashfree hosted checkout on success.
      await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not start checkout.");
      setPaying(false);
    }
  }

  // 4) Order review + pay
  if (draft) {
    return (
      <OrderReview
        draft={draft}
        paying={paying}
        error={payError}
        onEdit={() => {
          setPayError("");
          setDraft(null);
        }}
        onPay={handlePay}
      />
    );
  }

  // 3) Configure the item at the chosen shop
  if (selected && shop) {
    return (
      <section className="flex h-full min-h-0 flex-col">
        <PrintConfigurator
          category={selected}
          shop={shop}
          city={city}
          onBack={() => setShop(null)}
          onCheckout={setDraft}
        />
      </section>
    );
  }

  // 2) Available shops for the chosen product
  if (selected) {
    return (
      <ShopPicker
        category={selected}
        city={city}
        onCity={setCity}
        onBack={() => setSelected(null)}
        onPick={setShop}
      />
    );
  }

  // 1) Product catalog
  return (
    <section className="flex h-full min-h-0 flex-col">
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
              Pick a product, compare shops near you, and pay a fixed price — no waiting for quotes.
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
    </section>
  );
}

function ShopPicker({
  category,
  city,
  onCity,
  onBack,
  onPick,
}: {
  category: PrintCategory;
  city: string;
  onCity: (v: string) => void;
  onBack: () => void;
  onPick: (shop: PrintShop) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const detectedRef = useRef(false);

  // Auto-detect the user's city once so we can show nearby shops without them
  // typing. Silent fallback: if it fails/denied, we just show all shops.
  useEffect(() => {
    if (detectedRef.current || city.trim()) return;
    detectedRef.current = true;
    let active = true;
    setDetecting(true);
    detectCurrentCity()
      .then((c) => {
        if (active) onCity(c);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDetecting(false);
      });
    return () => {
      active = false;
    };
  }, [city, onCity]);

  const hasCity = city.trim().length >= 2;
  // Shops serving the chosen city (nearby), plus a full list as a fallback so
  // we never block the customer when a city has no matches or isn't known yet.
  const nearby = useAvailablePrintShops(category.id, city, hasCity);
  const all = useAvailablePrintShops(category.id, "", true);

  const nearbyShops = nearby.data ?? [];
  const usingNearby = hasCity && nearbyShops.length > 0;
  const shops = usingNearby ? nearbyShops : (all.data ?? []);
  // Never gate the list on geolocation — it can hang waiting for a permission
  // prompt. Only wait on the actual shop fetch that we're about to display.
  const loading = hasCity ? nearby.isLoading : all.isLoading;

  const statusText =
    detecting && !hasCity
      ? "Finding shops near you… showing all available shops"
      : usingNearby
        ? `Showing shops that serve ${city.trim()}`
        : hasCity
          ? `No shops serve ${city.trim()} yet — showing all available shops`
          : "Showing all available shops";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className={PAGE_HEADER}>
        <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← All products
        </button>
        <div className="mt-3 flex items-center gap-4">
          <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-5xl leading-none">
            {category.icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-100">{category.label}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Choose a shop to see live pricing.</p>
          </div>
        </div>

        <label className="mt-4 block text-sm text-zinc-400">
          Delivery city <span className="text-zinc-600">(optional)</span>
          <CityCombobox value={city} onChange={onCity} />
        </label>
      </div>

      <div className={SCROLL_BODY}>
        <p className="mb-3 text-xs text-zinc-500">{statusText}</p>
        <PrintShopList shops={shops} loading={loading} onPick={onPick} />
      </div>
    </section>
  );
}

function OrderReview({
  draft,
  paying,
  error,
  onEdit,
  onPay,
}: {
  draft: PrintOrderDraft;
  paying: boolean;
  error: string;
  onEdit: () => void;
  onPay: (draft: PrintOrderDraft) => void;
}) {
  const { attributes } = draft;
  const rows: { label: string; value: string }[] = [];
  if (attributes.size) rows.push({ label: "Size", value: attributes.size });
  if (attributes.material) rows.push({ label: "Material", value: attributes.material });
  if (attributes.printType) rows.push({ label: "Print", value: attributes.printType });
  if (attributes.color) rows.push({ label: "Colour", value: attributes.color });
  for (const [k, v] of Object.entries(attributes.extras ?? {})) {
    rows.push({ label: k.charAt(0).toUpperCase() + k.slice(1), value: v });
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className={PAGE_HEADER}>
        <button type="button" onClick={onEdit} className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Edit order
        </button>
        <h2 className="mt-3 text-xl font-semibold text-zinc-100">Review your order</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          {draft.category.label} · {draft.shop.name}
        </p>
      </div>

      <div className={SCROLL_BODY}>
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Shop</span>
              <span className="text-sm font-medium text-zinc-100">{draft.shop.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Quantity</span>
              <span className="text-sm text-zinc-100">
                {draft.quantity}
                {draft.category.pricingModel === "per_page" ? " copies" : " units"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Delivery city</span>
              <span className="text-sm text-zinc-100 capitalize">{draft.city}</span>
            </div>
            {draft.designFileName && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-zinc-400">File</span>
                <span className="max-w-[12rem] truncate text-sm text-zinc-100">
                  {draft.designFileName}
                </span>
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Options</p>
              <dl className="mt-2 space-y-1.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <dt className="text-zinc-400">{r.label}</dt>
                    <dd className="text-zinc-200">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {draft.notes && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</p>
              <p className="mt-1 text-sm text-zinc-300">{draft.notes}</p>
            </div>
          )}

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Total to pay</span>
              <span className="text-2xl font-semibold text-emerald-300">
                {money(draft.price.total)}
              </span>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-zinc-600">
            You pay {draft.shop.name} directly. Contact details unlock right after payment.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={paying}
              onClick={onEdit}
              className="flex-1 rounded-full border border-white/10 py-3 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Edit order
            </button>
            <button
              type="button"
              disabled={paying}
              onClick={() => onPay(draft)}
              className="btn-primary flex-1 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
            >
              {paying ? "Starting…" : `Pay ${money(draft.price.total)}`}
            </button>
          </div>
        </div>
      </div>
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

  if (catalog.length === 0) {
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
                {cat.description && <p className="mt-1 text-sm text-zinc-500">{cat.description}</p>}
                <p className="mt-1.5 text-xs text-zinc-600">{meta.useCase}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-xs text-zinc-600">
                {cat.pricingModel === "per_page" ? "Priced per page" : "Fixed shop pricing"}
              </span>
              <span className="text-xs font-medium text-zinc-400 transition group-hover:text-zinc-200">
                See shops →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CityCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
