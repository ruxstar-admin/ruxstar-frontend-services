import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Look {
  variant?: Variant;
  /** `lg` is the 50 px primary action. */
  size?: "md" | "lg";
  block?: boolean;
  icon?: ReactNode;
}

const classes = ({ variant = "primary", size = "md", block }: Look, extra?: string) =>
  [styles.button, styles[variant], styles[size], block && styles.block, extra].filter(Boolean).join(" ");

export function Button({
  variant,
  size,
  block,
  icon,
  loading = false,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: Look & ComponentProps<"button"> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={styles.label} data-hidden={loading || undefined}>
        {icon}
        {children}
      </span>
      {loading && <span className={styles.spinner} aria-hidden />}
    </button>
  );
}

export function ButtonLink({ variant, size, block, icon, children, className, ...rest }: Look & ComponentProps<typeof Link>) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      <span className={styles.label}>
        {icon}
        {children}
      </span>
    </Link>
  );
}
