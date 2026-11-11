"use client";

import { useId, useState, type ReactNode } from "react";
import { Button, Skeleton } from "@/components/ui";
import { formError } from "@/lib/api/account";
import styles from "./console.module.css";

export { styles };

export function Fact({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd data-warn={warn || undefined}>{value}</dd>
    </div>
  );
}

export function Rows({ count = 3, height = 72 }: { count?: number; height?: number }) {
  return (
    <div className={styles.list} aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius={14} />
      ))}
    </div>
  );
}

export function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={styles.failed} role="alert">
      <p>{formError(error).message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A 5 to 300 character reason that the person affected will read. */
export function ReasonForm({
  prompt,
  placeholder,
  confirm,
  busy,
  onCancel,
  onSubmit,
}: {
  prompt: string;
  placeholder: string;
  confirm: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  return (
    <div className={styles.reason}>
      <label className={styles.label} htmlFor={id}>
        {prompt}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder={placeholder}
        autoFocus
      />
      <div className={styles.actions}>
        <span className={styles.count}>{reason.length}/300</span>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" disabled={reason.trim().length < 5} loading={busy} onClick={() => onSubmit(reason.trim())}>
          {confirm}
        </Button>
      </div>
    </div>
  );
}

export const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
