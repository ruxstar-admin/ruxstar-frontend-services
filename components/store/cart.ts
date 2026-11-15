"use client";

import { useSyncExternalStore } from "react";
import type { CartLine, ChosenOption } from "@/lib/api/store-types";

/** One line as shown in the cart. The price and stock are only a reminder; the quote prices it again before paying. */
export interface CartItem extends CartLine {
  title: string;
  options: ChosenOption[];
  price: number;
  mrp: number | null;
  photoUrl: string | null;
}
/** One shop per cart, like the app. */
export interface Cart {
  shop: { id: string; name: string };
  items: CartItem[];
}

const KEY = "ruxstar.cart.v1";
const EVENT = "ruxstar-cart";
/** The backend's most lines per order and quantity per line are checked again at the quote. */
export const MAX_LINES = 50;
export const MAX_QUANTITY = 100;

let cached: { raw: string | null; cart: Cart | null } = { raw: null, cart: null };

function read(): Cart | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.cart;
  let cart: Cart | null = null;
  try {
    const parsed = raw ? (JSON.parse(raw) as Cart) : null;
    cart = parsed && parsed.shop?.id && Array.isArray(parsed.items) && parsed.items.length ? parsed : null;
  } catch {
    cart = null;
  }
  cached = { raw, cart };
  return cart;
}

function write(cart: Cart | null) {
  try {
    if (cart && cart.items.length) window.localStorage.setItem(KEY, JSON.stringify(cart));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage; the cart then lasts for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The cart on this device, kept in step across tabs. Undefined until the browser has read it. */
export function useCart(): Cart | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export const cartCount = (cart: Cart | null | undefined) => cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

/** Adds to the cart; false when the cart holds another shop's items, which the caller asks to clear first. */
export function addToCart(shop: Cart["shop"], item: CartItem, replace = false): boolean {
  const cart = read();
  if (cart && cart.shop.id !== shop.id && !replace) return false;
  const items = cart && cart.shop.id === shop.id ? [...cart.items] : [];
  const at = items.findIndex((i) => i.variantId === item.variantId);
  if (at >= 0) items[at] = { ...item, quantity: Math.min(MAX_QUANTITY, items[at]!.quantity + item.quantity) };
  else if (items.length < MAX_LINES) items.push(item);
  write({ shop, items });
  return true;
}

export function setQuantity(variantId: string, quantity: number) {
  const cart = read();
  if (!cart) return;
  const items = quantity <= 0 ? cart.items.filter((i) => i.variantId !== variantId) : cart.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(MAX_QUANTITY, quantity) } : i));
  write({ ...cart, items });
}

/** Refreshes what the cart shows from a quote. */
export function refreshItems(prices: { variantId: string; price: number; mrp: number | null }[]) {
  const cart = read();
  if (!cart) return;
  let changed = false;
  const items = cart.items.map((i) => {
    const p = prices.find((x) => x.variantId === i.variantId);
    if (!p || (p.price === i.price && p.mrp === i.mrp)) return i;
    changed = true;
    return { ...i, price: p.price, mrp: p.mrp };
  });
  if (changed) write({ ...cart, items });
}

export const clearCart = () => write(null);
