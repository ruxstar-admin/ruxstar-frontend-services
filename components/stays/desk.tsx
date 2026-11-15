"use client";

import { useRef } from "react";
import { useLoad } from "@/components/vendor/use-load";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { deskProperties, type DeskProperty } from "@/lib/api/stays";
import type { StaysPermission } from "@/lib/stays";

/** The properties you can run, and what you may do at `id`. The owner may do everything. */
export function useStaysDesk(id?: string) {
  const properties = useLoad(() => deskProperties(), "stays-desk");
  const property: DeskProperty | null = id ? (properties.data?.find((p) => p.id === id) ?? null) : null;
  const can = (permission: StaysPermission) => !!property && (property.owner || property.permissions.includes(permission));
  return { properties, property, can };
}

/**
 * One idempotency key per action and body: a retry after a dropped connection sends the same key, so it isn't done
 * twice; anything else gets a fresh key.
 */
export function useActionKey() {
  const held = useRef<{ sig: string; key: string } | null>(null);
  return {
    keyFor(sig: string) {
      if (held.current?.sig !== sig) held.current = { sig, key: newIdempotencyKey() };
      return held.current.key;
    },
    settle(err?: unknown) {
      if (!keepIdempotencyKey(err)) held.current = null;
    },
  };
}

export const deskBack = (property: DeskProperty | null, id: string) =>
  property?.owner ? { href: `/vendor/properties/${id}`, label: "Property" } : { href: "/beds", label: "Properties" };
