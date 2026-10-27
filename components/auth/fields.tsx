"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui";
import styles from "@/app/(auth)/auth.module.css";

type FieldProps = Omit<ComponentProps<typeof Input>, "label" | "onChange" | "value"> & {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
};

/** Indian mobile numbers. Pasted spaces, dashes and a leading +91 or 0 are dropped. */
export function PhoneField({ label = "Mobile number", value, onValueChange, ...rest }: FieldProps) {
  return (
    <Input
      label={label}
      prefix="+91"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="98765 43210"
      value={value}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").slice(0, 10))}
      {...rest}
    />
  );
}

export function PasswordField({ label = "Password", value, onValueChange, ...rest }: FieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      label={label}
      type={shown ? "text" : "password"}
      value={value}
      maxLength={64}
      onChange={(e) => onValueChange(e.target.value)}
      suffix={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
        >
          {shown ? "Hide" : "Show"}
        </button>
      }
      {...rest}
    />
  );
}

export function CodeField({ value, onValueChange, ...rest }: FieldProps) {
  return (
    <Input
      label="6-digit code"
      className={styles.code}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      {...rest}
    />
  );
}

export const validPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  return null;
}
