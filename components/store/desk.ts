"use client";

import { useLoad } from "@/components/vendor/use-load";
import { deskStores, type DeskStore } from "@/lib/api/store";

/** What the owner allows someone on the team to do at a local shop. The owner may do everything. */
export type StorePermission = "store.orders" | "store.move" | "store.cancel" | "store.returns" | "store.stock" | "store.products";

/** The shops you can run, and what you may do at `id`. */
export function useStoreDesk(id?: string) {
  const stores = useLoad(() => deskStores(), "store-desk");
  const store: DeskStore | null = id ? (stores.data?.find((s) => s.id === id) ?? null) : null;
  const can = (permission: StorePermission) => !!store && (store.owner || store.permissions.includes(permission));
  return { stores, store, can };
}

export const deskBack = (store: DeskStore | null, id: string) =>
  store?.owner ? { href: `/vendor/businesses/${id}`, label: "Business" } : { href: "/store", label: "Shops" };
