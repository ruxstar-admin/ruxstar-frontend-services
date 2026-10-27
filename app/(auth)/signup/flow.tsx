"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField, passwordProblem } from "@/components/auth/fields";
import { VerifyPhone } from "@/components/auth/VerifyPhone";
import { Button, Input } from "@/components/ui";
import { formError, nextPath, signUp, type FormError } from "@/lib/api/account";
import styles from "../auth.module.css";

export function SignUpFlow() {
  const router = useRouter();
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  if (!verificationToken) {
    return (
      <VerifyPhone
        purpose="signup"
        title="Create your account"
        lede="Start with your mobile number. We will text you a code to check it is yours."
        foot={
          <p className={styles.foot}>
            Already have an account? <Link href="/signin">Sign in</Link>
          </p>
        }
        onVerified={(token) => setVerificationToken(token)}
      />
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError({ message: "Enter your name.", field: "name" });
    const weak = passwordProblem(password);
    if (weak) return setError({ message: weak, field: "password" });
    if (!agreed) return setError({ message: "Agree to the terms to continue.", field: "consent" });
    setBusy(true);
    setError(null);
    try {
      await signUp({ verificationToken: verificationToken!, name: name.trim(), password });
      router.replace(nextPath());
    } catch (err) {
      setError(formError(err));
      setBusy(false);
    }
  }

  return (
    <div className={styles.step} key="details">
      <div className={styles.head}>
        <h1 className={styles.title}>A few details</h1>
        <p className={styles.lede}>Your number is confirmed. Add your name and choose a password.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Input
          label="Your name"
          autoComplete="name"
          autoFocus
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error?.field === "name" ? error.message : undefined}
        />
        <PasswordField
          value={password}
          onValueChange={setPassword}
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={error?.field === "password" ? error.message : undefined}
        />
        <label className={styles.consent}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span className={styles.inline}>
            I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        {error && error.field !== "name" && error.field !== "password" && (
          <p className={styles.formError} role="alert">
            {error.message}
            {(error.code === "VERIFICATION_INVALID" || error.code === "PHONE_TAKEN") && (
              <>
                {" "}
                <button type="button" className={styles.textButton} onClick={() => setVerificationToken(null)}>
                  Start again
                </button>
              </>
            )}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="lg" block loading={busy}>
            Create account
          </Button>
        </div>
      </form>
    </div>
  );
}
