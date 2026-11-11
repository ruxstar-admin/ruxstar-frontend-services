"use client";

import { useRef, useState, type FormEvent } from "react";
import { NewPasswordFields, PasswordField, passwordProblem } from "@/components/auth/fields";
import { Button, useToast } from "@/components/ui";
import { changePassword, formError, isSignedOut } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import styles from "./account.module.css";

/** Needs the current password. The API signs out every other device; this one stays signed in. */
export function PasswordPanel({ phone, onSignedOut }: { phone: string; onSignedOut: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const currentRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setCurrent("");
    setPassword("");
    setConfirmation("");
    setSubmitted(false);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!current) return setError({ message: "Enter your current password.", field: "currentPassword" });
    const weak = password ? passwordProblem(password, phone) : "Choose a new password.";
    if (weak) return setError({ message: weak, field: "newPassword" });
    if (confirmation !== password) return setError(null);
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, password);
      toast("Password changed. Other devices are signed out.", "success");
      close();
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError({ message: "That password is not right.", field: "currentPassword" });
        requestAnimationFrame(() => currentRef.current?.select());
      } else if (err instanceof ApiError && err.code === "PASSWORD_REUSED") {
        setError({ message: err.message, field: "newPassword" });
      } else {
        setError(formError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className={styles.panel}>
        <p className={styles.muted}>Use at least 8 characters, with a letter and a number.</p>
        <div className={styles.panelFoot}>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() => currentRef.current?.focus());
            }}
          >
            Change password
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.panel} onSubmit={submit} noValidate>
      <input type="text" name="username" autoComplete="username" value={phone} readOnly hidden />
      <PasswordField
        ref={currentRef}
        label="Current password"
        value={current}
        onValueChange={(v) => {
          setCurrent(v);
          if (error?.field === "currentPassword") setError(null);
        }}
        autoComplete="current-password"
        error={error?.field === "currentPassword" ? error.message : undefined}
      />
      <NewPasswordFields
        label="New password"
        password={password}
        confirmation={confirmation}
        onPasswordChange={(v) => {
          setPassword(v);
          if (error?.field === "newPassword") setError(null);
        }}
        onConfirmationChange={setConfirmation}
        phone={phone}
        submitted={submitted}
        error={error?.field === "newPassword" ? error.message : undefined}
      />
      {error && error.field !== "currentPassword" && error.field !== "newPassword" && (
        <p className={styles.formError} role="alert">
          {error.message}
        </p>
      )}
      <p className={styles.muted}>Other devices will be signed out. This one stays signed in.</p>
      <div className={styles.panelFoot}>
        <Button type="button" variant="secondary" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </div>
    </form>
  );
}
