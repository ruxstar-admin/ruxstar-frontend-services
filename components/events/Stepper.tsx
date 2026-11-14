"use client";

import { Icon } from "@/components/ui";
import styles from "./events.module.css";

/** Minus, the count, plus. `label` names what is counted, for screen readers: "General tickets". */
export function Stepper({ value, min = 0, max, onChange, label }: { value: number; min?: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.round} aria-label={`One less: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Icon name="minus" size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" className={styles.round} aria-label={`One more: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={16} />
      </button>
    </span>
  );
}
