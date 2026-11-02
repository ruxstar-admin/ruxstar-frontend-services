"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AccountUsername, NewPasswordFields, passwordProblem } from "@/components/auth/fields";
import { VerifyPhone } from "@/components/auth/VerifyPhone";
import { Button, ButtonLink } from "@/components/ui";
import { formError, resetPassword, signIn } from "@/lib/api/account";
import styles from "../auth.module.css";

export function ResetFlow() {
  const router = useRouter();
  const [verified, setVerified] = useState<{ token: string; phone: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  if (!verified) {
    return (
      <VerifyPhone
        purpose="reset"
        title="Reset your password"
        lede="Enter the number on your account. We will text you a code."
        foot={
          <p className={styles.foot}>
            Remembered it? <Link href="/signin">Sign in</Link>
          </p>
        }
        onVerified={(token, phone) => setVerified({ token, phone })}
      />
    );
  }

  if (done) {
    return (
      <div className={styles.step} key="done">
        <div className={styles.head}>
          <h1 className={styles.title}>Password changed</h1>
          <p className={styles.lede}>Every device was signed out. Sign in again with your new password.</p>
        </div>
        <ButtonLink href="/signin" size="lg" block>
          Sign in
        </ButtonLink>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const weak = password ? passwordProblem(password, verified!.phone) : "Choose a password.";
    if (weak) return setError({ message: weak, field: "password" });
    if (confirmation !== password) return setError(null);
    setBusy(true);
    setError(null);
    try {
      await resetPassword(verified!.token, password);
    } catch (err) {
      setError(formError(err));
      setBusy(false);
      return;
    }
    try {
      await signIn(verified!.phone, password);
      router.replace("/account");
    } catch {
      setDone(true);
      setBusy(false);
    }
  }

  return (
    <div className={styles.step} key="password">
      <div className={styles.head}>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.lede}>It cannot be one of your last three. Every other device will be signed out.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <AccountUsername phone={verified.phone} />
        <NewPasswordFields
          label="New password"
          password={password}
          confirmation={confirmation}
          onPasswordChange={(v) => {
            setPassword(v);
            if (error?.field === "password") setError(null);
          }}
          onConfirmationChange={setConfirmation}
          phone={verified.phone}
          submitted={submitted}
          autoFocus
          error={error?.field === "password" ? error.message : undefined}
        />
        {error && error.field !== "password" && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="lg" block loading={busy}>
            Save password
          </Button>
        </div>
      </form>
    </div>
  );
}
