"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Toast.module.css";

type Tone = "neutral" | "success" | "danger";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  leaving: boolean;
}

const SHOW_MS = 4000;
const LEAVE_MS = 320;
const MAX = 3;

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast needs a <ToastProvider> above it");
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const later = useCallback((fn: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      fn();
    }, ms);
    timers.current.add(timer);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      later(() => setItems((list) => list.filter((t) => t.id !== id)), LEAVE_MS);
    },
    [later],
  );

  const show = useCallback(
    (message: string, tone: Tone = "neutral") => {
      const id = ++nextId.current;
      setItems((list) => [...list, { id, message, tone, leaving: false }].slice(-MAX));
      later(() => dismiss(id), SHOW_MS);
    },
    [dismiss, later],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={styles.toast} data-tone={t.tone} data-leaving={t.leaving || undefined}>
            {t.tone !== "neutral" && <Icon name={t.tone === "success" ? "check" : "alert"} size={18} />}
            <span>{t.message}</span>
            <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
