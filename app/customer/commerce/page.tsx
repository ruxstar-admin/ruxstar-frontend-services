"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createCommerceOrder,
  getCommerceShop,
  listCommerceShops,
  payCommerceOrder,
  type CommerceProduct,
  type CommerceShop,
} from "@/lib/api";
import { openCashfreeCheckout } from "@/lib/cashfree-checkout";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type CartLine = { product: CommerceProduct; quantity: number };

export default function CustomerCommercePage() {
  const [shops, setShops] = useState<CommerceShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shopId, setShopId] = useState<string | null>(null);
  const [shop, setShop] = useState<CommerceShop | null>(null);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listCommerceShops();
        if (!cancelled) setShops(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load shops");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getCommerceShop(shopId);
        if (!cancelled) {
          setShop(data.shop);
          setProducts(data.products);
          setCart([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load shop");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [shops, query]);

  const cartTotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  function setQty(product: CommerceProduct, quantity: number) {
    setCart((prev) => {
      const next = prev.filter((l) => l.product.id !== product.id);
      if (quantity <= 0) return next;
      return [...next, { product, quantity: Math.min(quantity, product.stock) }];
    });
  }

  async function checkout() {
    if (!shop || !cart.length) return;
    if (shop.minOrderValue > 0 && cartTotal < shop.minOrderValue) {
      setError(`Minimum order is ${money(shop.minOrderValue)}`);
      return;
    }
    setPaying(true);
    setError("");
    try {
      const order = await createCommerceOrder({
        businessId: shop.id,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        notes: notes.trim() || undefined,
      });
      const { payment } = await payCommerceOrder(order.id);
      await openCashfreeCheckout(payment.paymentSessionId, payment.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setPaying(false);
    }
  }

  if (shopId && shop) {
    const closed = !shop.acceptingOrders;
    return (
      <section className={`flex h-full min-h-0 flex-col ${closed ? "opacity-60" : ""}`}>
        <div className="shrink-0 border-b border-white/5 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setShopId(null);
              setShop(null);
              setProducts([]);
              setCart([]);
              setError("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            ← All shops
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-100">{shop.name}</h1>
            {closed && (
              <span className="rounded-full border border-zinc-500/30 bg-white/[0.03] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                Closed
              </span>
            )}
          </div>
          {shop.address && <p className="mt-0.5 text-xs text-zinc-500">{shop.address}</p>}
          {closed ? (
            <p className="mt-2 text-sm text-zinc-400">
              This shop is temporarily offline and not accepting new orders.
            </p>
          ) : (
            shop.notes && <p className="mt-2 text-sm text-zinc-400">{shop.notes}</p>
          )}
        </div>

        <div className="scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6">
          {error && (
            <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
          {closed ? (
            <p className="text-sm text-zinc-500">Come back when the shop is open again.</p>
          ) : loading ? (
            <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
          ) : products.length === 0 ? (
            <p className="text-sm text-zinc-500">This shop has not listed any products yet.</p>
          ) : (
            <ul className="space-y-3">
              {products.map((p) => {
                const line = cart.find((l) => l.product.id === p.id);
                const qty = line?.quantity ?? 0;
                const soldOut = p.stock <= 0;
                return (
                  <li
                    key={p.id}
                    className={`flex gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3 ${
                      soldOut ? "opacity-55" : ""
                    }`}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                      {p.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-100">{p.name}</p>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{p.description}</p>
                      )}
                      <p className="mt-1 text-sm text-emerald-300">
                        {money(p.price)}
                        <span className="ml-2 text-xs text-zinc-600">
                          {soldOut ? "Out of stock" : `${p.stock} left`}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {soldOut ? (
                        <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-500">
                          Unavailable
                        </span>
                      ) : qty > 0 ? (
                        <>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-white/15 text-sm"
                            onClick={() => setQty(p, qty - 1)}
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm">{qty}</span>
                          <button
                            type="button"
                            className="h-8 w-8 rounded-full border border-white/15 text-sm"
                            disabled={qty >= p.stock}
                            onClick={() => setQty(p, qty + 1)}
                          >
                            +
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
                          onClick={() => setQty(p, 1)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cartCount > 0 && (
          <div className="shrink-0 border-t border-white/8 bg-[#0a0a0b] px-4 py-3 sm:px-6">
            <textarea
              className="field-input mb-2 min-h-[2.5rem] resize-none text-sm"
              placeholder="Order notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {cartCount} item{cartCount === 1 ? "" : "s"} · {money(cartTotal)}
                </p>
                {shop.minOrderValue > 0 && (
                  <p className="text-[11px] text-zinc-500">
                    Min order {money(shop.minOrderValue)} · Pickup after payment
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={paying}
                onClick={() => void checkout()}
                className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {paying ? "Opening checkout…" : "Pay & order"}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/5 px-4 py-4 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Shop</p>
        <h1 className="mt-1 text-2xl font-semibold">
          <span className="text-gradient">Commerce</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse shops, add products to your cart, pay, then pick up.
        </p>
        <input
          className="field-input mt-3"
          placeholder="Search shops"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="scroll-pane min-h-0 flex-1 px-4 py-4 sm:px-6">
        {error && (
          <p className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="flex min-h-[12rem] flex-col items-center justify-center text-center">
            <p className="text-sm text-zinc-500">No live shops yet.</p>
            <Link href="/customer" className="mt-3 text-xs text-amber-200 hover:underline">
              Back to Discover
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredShops.map((s) => {
              const closed = !s.acceptingOrders;
              const soldOut = !closed && s.inStockCount === 0;
              return (
              <button
                key={s.id}
                type="button"
                onClick={() => !closed && setShopId(s.id)}
                disabled={closed}
                className={`rounded-2xl border p-4 text-left transition ${
                  closed
                    ? "cursor-not-allowed border-white/8 bg-white/[0.01] opacity-55"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15"
                }`}
              >
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {s.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-lg">🛍️</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-zinc-100">{s.name}</p>
                      {closed && (
                        <span className="shrink-0 rounded-full border border-zinc-500/30 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          Closed
                        </span>
                      )}
                      {soldOut && (
                        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                          Sold out
                        </span>
                      )}
                    </div>
                    {s.address && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{s.address}</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-400">
                      {closed
                        ? "Temporarily offline"
                        : soldOut
                          ? "Everything sold out — check back soon"
                          : `${s.inStockCount ?? s.productCount ?? 0} product${
                              (s.inStockCount ?? s.productCount ?? 0) === 1 ? "" : "s"
                            } available${s.minOrderValue > 0 ? ` · min ${money(s.minOrderValue)}` : ""}`}
                    </p>
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
