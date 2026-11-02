"use client";

import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Icon, Input } from "@/components/ui";
import { suggestUsernames } from "@/lib/api/account";
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

export function passwordProblem(password: string, phone?: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 64) return "Use 64 characters or fewer.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (phone && password.includes(phone)) return "Do not use your phone number in your password.";
  return null;
}

/** The same rules the API checks, shown beside the field while typing. */
export const passwordRules = (password: string, phone?: string) => [
  { label: "8 to 64 characters", met: password.length >= 8 && password.length <= 64 },
  { label: "A letter and a number", met: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ...(phone ? [{ label: "Not your phone number", met: password.length > 0 && !password.includes(phone) }] : []),
];

/**
 * New password and its confirmation, with the rules listed under the first and tied to it.
 * Unmet rules turn red once the field is left or the form was submitted.
 */
export function NewPasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  phone,
  submitted,
  error,
  label = "Password",
  autoFocus,
}: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  phone?: string;
  submitted: boolean;
  /** From the API, for the password field. */
  error?: string;
  label?: string;
  autoFocus?: boolean;
}) {
  const rulesId = useId();
  const [touched, setTouched] = useState(false);
  const strict = touched || submitted;
  const mismatch =
    confirmation.length > 0 && confirmation !== password
      ? "Passwords do not match."
      : submitted && !confirmation
        ? "Re-enter your password."
        : undefined;

  return (
    <div className={styles.passwords}>
      <div className={styles.group}>
        <PasswordField
          label={label}
          value={password}
          onValueChange={onPasswordChange}
          onBlur={() => setTouched(true)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          placeholder="Create a password"
          {...(error ? {} : { "aria-describedby": rulesId })}
          error={error}
        />
        <ul id={rulesId} className={styles.rules} aria-label="Password rules">
          {passwordRules(password, phone).map((rule) => (
            <li key={rule.label} data-state={rule.met ? "met" : strict ? "unmet" : "todo"}>
              <Icon name={rule.met ? "check" : strict ? "close" : "minus"} size={14} />
              <span>{rule.label}</span>
              <span className="sr-only">{rule.met ? " (done)" : " (not yet)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <PasswordField
        label="Confirm password"
        value={confirmation}
        onValueChange={onConfirmationChange}
        autoComplete="new-password"
        placeholder="Re-enter your password"
        error={mismatch}
      />
    </div>
  );
}

const HANDLE = /^[a-z0-9_.]{3,20}$/;
export const validUsername = (username: string) => HANDLE.test(username);

export type HandleStatus = "idle" | "checking" | "available" | "taken" | "error";

/**
 * Checks the typed handle after a pause, and offers free ones from the name, but only once the box
 * has been entered: typing the name never calls the API. "Checking" shows only while a request is out.
 */
export function useUsernameCheck(username: string, name: string, entered: boolean) {
  const [result, setResult] = useState<{ for: string; status: HandleStatus; suggestions: string[] } | null>(null);
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<{ for: string; list: string[] } | null>(null);
  const seed = name.trim();
  const latestSeed = useRef(seed);
  const wantIdeas = entered && username.length === 0 && nameProblem(seed) === null;

  useEffect(() => {
    latestSeed.current = seed;
  }, [seed]);

  useEffect(() => {
    if (!validUsername(username)) return;
    let live = true;
    const timer = setTimeout(() => {
      setInFlight(username);
      suggestUsernames(latestSeed.current || "you", username).then(
        (r) => live && setResult({ for: username, status: r.available ? "available" : "taken", suggestions: r.suggestions }),
        () => live && setResult({ for: username, status: "error", suggestions: [] }),
      );
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [username]);

  useEffect(() => {
    if (!wantIdeas || ideas?.for === seed) return;
    let live = true;
    suggestUsernames(seed).then(
      (r) => live && setIdeas({ for: seed, list: r.suggestions }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [wantIdeas, seed, ideas?.for]);

  if (!validUsername(username)) {
    return { status: "idle" as HandleStatus, suggestions: username.length === 0 && ideas?.for === seed ? ideas.list : [] };
  }
  if (result?.for === username) return { status: result.status, suggestions: result.suggestions };
  return { status: (inFlight === username ? "checking" : "idle") as HandleStatus, suggestions: [] as string[] };
}

export function UsernameField({
  value,
  onValueChange,
  check,
  onFocus,
  error,
}: {
  value: string;
  onValueChange: (value: string) => void;
  check: { status: HandleStatus; suggestions: string[] };
  onFocus?: () => void;
  error?: string;
}) {
  const invalid = value.length > 0 && !validUsername(value) ? "Use 3 to 20 lowercase letters, numbers, dots or underscores." : undefined;
  const note = {
    idle: "People find and mention you with this.",
    checking: "Checking availability…",
    available: `@${value} is free.`,
    taken: undefined,
    error: "Could not check right now. You can still continue.",
  }[check.status];
  const showIdeas = check.suggestions.length > 0 && (check.status === "taken" || value.length === 0);

  return (
    <div className={styles.group}>
      <Input
        label="Username"
        name="handle"
        prefix="@"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        placeholder="yourname"
        value={value}
        onFocus={onFocus}
        onChange={(e) => onValueChange(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
        hint={note}
        error={error ?? invalid ?? (check.status === "taken" ? `@${value} is taken. Try one of these.` : undefined)}
      />
      {showIdeas && (
        <div className={styles.suggestions} role="group" aria-label="Free usernames">
          {check.suggestions.map((s) => (
            <button key={s} type="button" className={styles.chip} onClick={() => onValueChange(s)}>
              @{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const MIN_AGE_YEARS = 13;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The latest date of birth that is old enough today, as YYYY-MM-DD. */
export const latestDob = (now = new Date()) => isoOf(new Date(now.getFullYear() - MIN_AGE_YEARS, now.getMonth(), now.getDate()));

export function dobProblem(dob: string, now = new Date()): string | null {
  if (!dob) return "Choose your date of birth.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dob < "1900-01-01") return "Choose a real date.";
  return dob > latestDob(now) ? `You need to be at least ${MIN_AGE_YEARS} years old.` : null;
}

export const validEmail = (email: string) => email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
