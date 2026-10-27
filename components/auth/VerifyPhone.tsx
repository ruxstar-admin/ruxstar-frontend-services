"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { formError, requestCode, verifyCode, type Purpose } from "@/lib/api/account";
import styles from "@/app/(auth)/auth.module.css";
import { CodeField, PhoneField, validPhone } from "./fields";

interface Props {
  purpose: Purpose;
  title: string;
  lede: string;
  /** Shown under the phone form, for example a link to sign in. */
  foot?: ReactNode;
  onVerified: (verificationToken: string, phone: string) => void;
}

const pretty = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;

/** Number, then the texted code. Hands back a verification token for signup or reset. */
export function VerifyPhone({ purpose, title, lede, foot, onVerified }: Props) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const sent = await requestCode(phone, purpose);
      setResendAt(Date.now() + sent.resendInSeconds * 1000);
      setNow(Date.now());
      setCode("");
      setStep("code");
      requestAnimationFrame(() => codeRef.current?.focus());
    } catch (err) {
      setError(formError(err));
    } finally {
      setBusy(false);
    }
  }

  async function check(value: string) {
    setBusy(true);
    setError(null);
    try {
      const { verificationToken } = await verifyCode(phone, purpose, value);
      onVerified(verificationToken, phone);
    } catch (err) {
      setError(formError(err));
      setBusy(false);
    }
  }

  function submitPhone(e: FormEvent) {
    e.preventDefault();
    if (!validPhone(phone)) {
      setError({ message: "Enter a 10-digit mobile number.", field: "phone" });
      return;
    }
    void send();
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError({ message: "Enter the 6-digit code from the SMS.", field: "code" });
      return;
    }
    void check(code);
  }

  if (step === "phone") {
    return (
      <div className={styles.step} key="phone">
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lede}>{lede}</p>
        </div>
        <form className={styles.form} onSubmit={submitPhone} noValidate>
          <PhoneField
            value={phone}
            onValueChange={setPhone}
            autoFocus
            error={error?.field === "phone" ? error.message : undefined}
          />
          {error && error.field !== "phone" && (
            <p className={styles.formError} role="alert">
              {error.message}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="submit" size="lg" block loading={busy}>
              Send code
            </Button>
          </div>
        </form>
        {foot}
      </div>
    );
  }

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <div className={styles.step} key="code">
      <div className={styles.head}>
        <h1 className={styles.title}>Enter the code</h1>
        <p className={styles.lede}>We sent a 6-digit code to {pretty(phone)}. It works for 5 minutes.</p>
      </div>
      <form className={styles.form} onSubmit={submitCode} noValidate>
        <CodeField
          ref={codeRef}
          value={code}
          onValueChange={(value) => {
            setCode(value);
            if (value.length === 6 && !busy) void check(value);
          }}
          error={error?.field === "code" ? error.message : undefined}
        />
        {error && error.field !== "code" && (
          <p className={styles.formError} role="alert">
            {error.message}
          </p>
        )}
        <div className={styles.row}>
          <button type="button" className={styles.textButton} onClick={() => setStep("phone")}>
            Change number
          </button>
          <button type="button" className={styles.textButton} disabled={wait > 0 || busy} onClick={() => void send()}>
            {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
          </button>
        </div>
        <div className={styles.actions}>
          <Button type="submit" size="lg" block loading={busy}>
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
