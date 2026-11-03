"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Page } from "@/lib/api/social";

/**
 * A cursor-paged list. Starts from `initial` when the server already rendered the first page,
 * otherwise loads it. One request at a time, so a fast scroll never asks for a page twice.
 */
export function usePages<T>(load: (cursor?: string) => Promise<Page<T>>, initial?: Page<T>) {
  const loadRef = useRef(load);
  const cursor = useRef<string | null>(initial?.nextCursor ?? null);
  const busy = useRef(false);
  const [items, setItems] = useState<T[]>(initial?.items ?? []);
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initial ? initial.nextCursor !== null : false);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(initial ? -1 : 0);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (attempt < 0) return;
    let live = true;
    busy.current = true;
    loadRef
      .current()
      .then((page) => {
        if (!live) return;
        cursor.current = page.nextCursor;
        setItems(page.items);
        setHasMore(page.nextCursor !== null);
        setError(null);
      })
      .catch((err) => live && setError(err))
      .finally(() => {
        busy.current = false;
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const more = useCallback(() => {
    if (busy.current || cursor.current === null) return;
    busy.current = true;
    setLoadingMore(true);
    loadRef
      .current(cursor.current)
      .then((page) => {
        cursor.current = page.nextCursor;
        setItems((prev) => [...prev, ...page.items]);
        setHasMore(page.nextCursor !== null);
      })
      .catch(setError)
      .finally(() => {
        busy.current = false;
        setLoadingMore(false);
      });
  }, []);

  /** Loads the first page again, quietly when there is something on screen. */
  const reload = useCallback(() => {
    setError(null);
    setAttempt((n) => Math.max(n, 0) + 1);
  }, []);

  return { items, setItems, loading, loadingMore, hasMore, error, more, reload };
}

/** Calls `onVisible` when the returned element scrolls near the viewport. */
export function useNearEnd(onVisible: () => void, enabled: boolean) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  });
  useEffect(() => {
    if (!node || !enabled) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && callback.current(), {
      rootMargin: "800px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, enabled]);
  return setNode;
}
