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

/**
 * Tells password managers which account a new password belongs to. Without it they take the
 * first text box on the form (the name) as the username and fill the saved number into it.
 */
export function AccountUsername({ phone }: { phone: string }) {
  return <input type="text" name="username" autoComplete="username" value={phone} readOnly hidden />;
}

export const validPhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

export const prettyPhone = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;

/** Matches the API: a name needs letters and is not a phone number. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Enter your name.";
  if (!/\p{L}/u.test(trimmed) || /\d{6,}/.test(trimmed)) return "Enter your name, not a number.";
  return null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 64) return "Use 64 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  return null;
}
