"use client";

import { useRef, useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/fields";
import { Button } from "@/components/ui";
import { deleteAccount, formError, isSignedOut } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import styles from "./account.module.css";

/** Asks for the password before deleting, as the app does. */
export function DeletePanel({ onDeleted, onSignedOut }: { onDeleted: () => void; onSignedOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError({ message: "Enter your password.", field: "password" });
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onDeleted();
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      setBusy(false);
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError({ message: "That password is not right.", field: "password" });
        requestAnimationFrame(() => passwordRef.current?.select());
        return;
      }
      setError({ message: formError(err).message });
    }
  }

  if (!open) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Your profile, username and posts go away, and every device is signed out.</p>
        <div className={styles.panelFoot}>
          <Button
            variant="danger"
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() => passwordRef.current?.focus());
            }}
          >
            Delete account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.panel} onSubmit={submit} noValidate aria-labelledby="delete-title">
      <p id="delete-title" className={styles.dangerTitle}>
        Delete your account?
      </p>
      <p className={styles.muted}>This schedules permanent deletion of your profile and posts.</p>
      <PasswordField
        ref={passwordRef}
        label="Your password"
        value={password}
        onValueChange={(v) => {
          setPassword(v);
          setError(null);
        }}
        autoComplete="current-password"
        error={error?.field === "password" ? error.message : undefined}
      />
      {error && error.field !== "password" && (
        <p className={styles.formError} role="alert">
          {error.message}
        </p>
      )}
      <div className={styles.panelFoot}>
        <Button type="button" variant="secondary" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={busy} disabled={!password}>
          Delete account
        </Button>
      </div>
    </form>
  );
}
