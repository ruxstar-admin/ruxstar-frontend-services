"use client";

import { useId, type ReactNode } from "react";
import styles from "./shop.module.css";

/** A labelled dropdown in a Discover filter row. The first option is "any", so the box is outlined once something else is picked. */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className={styles.filter}>
      <label className={styles.filterLabel} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={styles.filterControl}
        data-set={value !== options[0]?.value ? true : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Filters side by side, wrapping onto a second line instead of scrolling sideways. */
export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.filterRow} role="group" aria-label={label}>
      {children}
    </div>
  );
}
