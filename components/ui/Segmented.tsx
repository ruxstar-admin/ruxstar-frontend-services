"use client";

import { useRef, type KeyboardEvent } from "react";
import styles from "./Segmented.module.css";

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  /** `null` until the person picks one. */
  value: T | null;
  onChange: (value: T) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}

export function Segmented<T extends string>({ label, options, value, onChange, invalid, ...rest }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);
  const index = Math.max(0, selected);

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = selected < 0 ? (step > 0 ? 0 : options.length - 1) : (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={rest["aria-describedby"]}
      className={styles.group}
      data-invalid={invalid ? true : undefined}
      style={{ "--count": options.length, "--index": index } as React.CSSProperties}
      onKeyDown={onKeyDown}
    >
      {selected >= 0 && <span className={styles.thumb} aria-hidden />}
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === selected}
          tabIndex={i === index ? 0 : -1}
          className={styles.option}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
