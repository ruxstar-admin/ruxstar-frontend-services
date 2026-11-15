"use client";

import { useEffect, useState } from "react";
import { useOnSignedOut } from "@/components/social/session";
import { findUsers, type UserRow, type UserStatus } from "@/lib/api/admin";

/** Waits this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;
const SHOWN = 8;

export interface UserSearch {
  /** The latest results, kept while the next search runs. `null` below 2 characters. */
  results: UserRow[] | null;
  searching: boolean;
  error: unknown;
}

/** People matching phone digits, @username or a name, once there are 2 characters. Needs `users.view`. */
export function useUserSearch(text: string, status?: UserStatus): UserSearch {
  const onSignedOut = useOnSignedOut();
  const q = text.trim();
  const [found, setFound] = useState<{ q: string; results: UserRow[] } | null>(null);
  const [failed, setFailed] = useState<{ q: string; error: unknown } | null>(null);

  useEffect(() => {
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      findUsers(q, status).then(
        (page) => live && setFound({ q, results: page.items.slice(0, SHOWN) }),
        (error) => live && !onSignedOut(error) && setFailed({ q, error }),
      );
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, status, onSignedOut]);

  if (q.length < 2) return { results: null, searching: false, error: null };
  const error = failed?.q === q ? failed.error : null;
  return { results: found?.results ?? null, searching: found?.q !== q && !error, error };
}
