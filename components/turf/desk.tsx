"use client";

import { useRef } from "react";
import { useLoad } from "@/components/vendor/use-load";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { deskGrounds, type DeskGround } from "@/lib/api/turf";
import type { TurfPermission } from "@/lib/turf";

/** The grounds you can run, and what you may do at `id`. The owner may do everything. */
export function useDesk(id?: string) {
  const grounds = useLoad(() => deskGrounds(), "desk");
  const ground: DeskGround | null = id ? (grounds.data?.find((g) => g.id === id) ?? null) : null;
  const can = (permission: TurfPermission) => !!ground && (ground.owner || ground.permissions.includes(permission));
  return { grounds, ground, can };
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
      if (!(err instanceof ApiError && err.code === "NETWORK")) held.current = null;
    },
  };
}

export const deskBack = (ground: DeskGround | null, id: string) =>
  ground?.owner ? { href: `/vendor/grounds/${id}`, label: "Ground" } : { href: "/board", label: "Grounds" };
