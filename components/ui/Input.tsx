import { useId, type ComponentProps, type ReactNode } from "react";
import styles from "./Input.module.css";

interface InputProps extends Omit<ComponentProps<"input">, "prefix"> {
  label: string;
  hint?: string;
  error?: string;
  /** Fixed text before the value, for example +91. */
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ label, hint, error, prefix, suffix, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.box} data-invalid={error ? true : undefined}>
        {prefix && <span className={styles.affix}>{prefix}</span>}
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...rest}
        />
        {suffix && <span className={styles.affix}>{suffix}</span>}
      </div>
      {note && (
        <p id={noteId} className={error ? styles.error : styles.hint} role={error ? "alert" : undefined}>
          {note}
        </p>
      )}
    </div>
  );
}
