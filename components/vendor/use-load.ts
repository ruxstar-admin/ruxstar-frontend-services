"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useOnSignedOut } from "@/components/social/session";

export interface Loaded<T> {
  data: T | null;
  error: unknown;
  reload: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
}

/** Loads once per `key`, keeps the last data while reloading, and sends ended sessions to sign in. */
export function useLoad<T>(load: () => Promise<T>, key = ""): Loaded<T> {
  const onSignedOut = useOnSignedOut();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let live = true;
    loader.current().then(
      (value) => {
        if (!live) return;
        setData(value);
        setError(null);
      },
      (err: unknown) => {
        if (!live || onSignedOut(err)) return;
        setError(err);
      },
    );
    return () => {
      live = false;
    };
  }, [key, attempt, onSignedOut]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, error, reload, setData };
}
