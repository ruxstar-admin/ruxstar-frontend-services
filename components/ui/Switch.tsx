"use client";

import type { ReactNode } from "react";
import styles from "./Switch.module.css";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, children, description, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span className={styles.label}>{children}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <span className={styles.track} aria-hidden>
        <span className={styles.knob} />
      </span>
    </button>
  );
}
