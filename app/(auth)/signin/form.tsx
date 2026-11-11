"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField, PhoneField, validPhone } from "@/components/auth/fields";
import { VerifyPhone } from "@/components/auth/VerifyPhone";
import { Button } from "@/components/ui";
import { formError, homeFor, nextPath, signIn, signInWithCode } from "@/lib/api/account";
import styles from "../auth.module.css";

export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "code">("password");
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
      const user = await signIn(phone, password);
      router.replace(nextPath(homeFor(user)));
    } catch (err) {
      setError(formError(err));
      setBusy(false);
    }
  }

  const foot = (
    <p className={styles.foot}>
      New to Ruxstar? <Link href="/signup">Create an account</Link>
    </p>
  );

  if (mode === "code") {
    return (
      <VerifyPhone
        key="code"
        purpose="login"
        title="Sign in with a code"
        lede="We'll text a 6-digit code to your mobile number."
        initialPhone={validPhone(phone) ? phone : ""}
        submitCode={async (number, code) => {
          const user = await signInWithCode(number, code);
          router.replace(nextPath(homeFor(user)));
        }}
        foot={
          <>
            <div className={styles.row}>
              <button type="button" className={styles.textButton} onClick={() => setMode("password")}>
                Use your password instead
              </button>
            </div>
            {foot}
          </>
        }
      />
    );
  }

  return (
    <div className={styles.step} key="password">
      <div className={styles.head}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.lede}>Sign in with your password or a one-time code.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <PhoneField
          name="username"
          autoComplete="username"
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
        {error && error.field !== "phone" && error.field !== "password" && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <div className={styles.row}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setError(null);
              setMode("code");
            }}
          >
            Sign in with a code
          </button>
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
      {foot}
    </div>
  );
}
