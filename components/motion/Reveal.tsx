"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./Reveal.module.css";

interface RevealProps {
  children: ReactNode;
  /** Stagger siblings by passing 0, 1, 2... Each step is 70 ms. */
  index?: number;
  as?: "div" | "section" | "li";
  className?: string;
}

/** Rises in once when it enters the screen. Not tied to scroll position. */
export function Reveal({ children, index = 0, as: Tag = "div", className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.in = "";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
