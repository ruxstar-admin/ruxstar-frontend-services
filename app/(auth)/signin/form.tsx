"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField, PhoneField, validPhone } from "@/components/auth/fields";
import { Button } from "@/components/ui";
import { formError, nextPath, signIn } from "@/lib/api/account";
import styles from "../auth.module.css";

export function SignInForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validPhone(phone)) return setError({ message: "Enter a 10-digit mobile number.", field: "phone" });
    if (!password) return setError({ message: "Enter your password.", field: "password" });
    setBusy(true);
    setError(null);
    try {
      await signIn(phone, password);
      router.replace(nextPath());
    } catch (err) {
      setError(formError(err));
      setBusy(false);
    }
  }

  return (
    <div className={styles.step}>
      <div className={styles.head}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.lede}>Sign in with your mobile number and password.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <PhoneField
          value={phone}
          onValueChange={setPhone}
          autoFocus
          error={error?.field === "phone" ? error.message : undefined}
        />
        <PasswordField
          value={password}
          onValueChange={setPassword}
          autoComplete="current-password"
          error={error?.field === "password" ? error.message : undefined}
        />
        {error && !error.field && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <div className={styles.row}>
          <span />
          <Link href="/reset" className={styles.textButton}>
            Forgot password?
          </Link>
        </div>
        <div className={styles.actions}>
          <Button type="submit" size="lg" block loading={busy}>
            Sign in
          </Button>
        </div>
      </form>
      <p className={styles.foot}>
        New to Ruxstar? <Link href="/signup">Create an account</Link>
      </p>
    </div>
  );
}
