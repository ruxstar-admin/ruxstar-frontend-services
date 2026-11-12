"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Button, Icon, Skeleton } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { MODULE_ICON, type Business } from "@/lib/api/vendor";
import frame from "@/components/admin/console.module.css";
import styles from "./vendor.module.css";

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.page} aria-busy aria-label="Loading">
      <Skeleton height={34} width="40%" radius={10} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={88} radius={16} />
      ))}
    </div>
  );
}

export function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={frame.failed} role="alert">
      <p>{formError(error).message}</p>
      <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function Back({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.back}>
      <Icon name="arrow-left" size={16} />
      {children}
    </Link>
  );
}

/** The first photo, or the module's icon. */
export function Cover({ business }: { business: Business }) {
  const photo = business.photos[0];
  return <span className={styles.cover}>{photo ? <img src={photo.url} alt="" /> : <Icon name={MODULE_ICON[business.module]} size={24} />}</span>;
}

/** A switch on its own, for rows that already say what it is. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.toggleSwitch}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleKnob} />
    </button>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}

export function Select({ label, value, options, onChange, placeholder, error, disabled }: SelectProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  max,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea id={id} className={styles.textarea} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <div className={styles.spread}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        <span className={styles.count}>{`${value.length}/${max}`}</span>
      </div>
    </div>
  );
}
