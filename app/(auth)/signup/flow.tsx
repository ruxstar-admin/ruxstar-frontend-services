"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import {
  AccountUsername,
  NewPasswordFields,
  UsernameField,
  dobProblem,
  latestDob,
  nameProblem,
  passwordProblem,
  prettyPhone,
  useUsernameCheck,
  validEmail,
  validUsername,
  type HandleStatus,
} from "@/components/auth/fields";
import { SuccessBadge } from "@/components/auth/SuccessBadge";
import { PhotoPicker } from "@/components/profile/PhotoPicker";
import { VerifyPhone } from "@/components/auth/VerifyPhone";
import { Button, ButtonLink, Input, Segmented } from "@/components/ui";
import { formError, nextPath, signUp, type FormError, type Gender } from "@/lib/api/account";
import styles from "../auth.module.css";

const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const satisfies readonly { value: Gender; label: string }[];

interface Details {
  name: string;
  username: string;
  dob: string;
  gender: Gender | null;
  email: string;
  password: string;
  confirmation: string;
  agreed: boolean;
}

type Field = keyof Details;

function problemsOf(form: Details, handle: HandleStatus, phone: string): Partial<Record<Field, string>> {
  const problems: Partial<Record<Field, string>> = {};
  const name = form.name.trim();
  if (!name) problems.name = "Enter your full name.";
  else if (nameProblem(name)) problems.name = nameProblem(name)!;
  if (!form.username) problems.username = "Choose a username.";
  else if (!validUsername(form.username)) problems.username = "Use 3 to 20 lowercase letters, numbers, dots or underscores.";
  else if (handle !== "available") problems.username = "Pick a username that is available.";
  const dob = dobProblem(form.dob);
  if (dob) problems.dob = dob;
  if (!form.gender) problems.gender = "Choose one.";
  if (!validEmail(form.email.trim())) problems.email = "Enter a valid email address.";
  if (!form.password) problems.password = "Choose a password.";
  else if (passwordProblem(form.password, phone)) problems.password = passwordProblem(form.password, phone)!;
  if (form.confirmation !== form.password || !form.confirmation) problems.confirmation = "Re-enter the same password.";
  if (!form.agreed) problems.agreed = "Agree to the terms to create your account.";
  return problems;
}

export function SignUpFlow() {
  const [verified, setVerified] = useState<{ token: string; phone: string } | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [photoStepDone, setPhotoStepDone] = useState(false);

  if (created !== null) {
    return photoStepDone ? <Created name={created} /> : <AddPhoto name={created} onDone={() => setPhotoStepDone(true)} />;
  }

  if (!verified) {
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
        onVerified={(token, phone) => setVerified({ token, phone })}
      />
    );
  }

  return <DetailsStep verified={verified} onRestart={() => setVerified(null)} onCreated={setCreated} />;
}

function DetailsStep({
  verified,
  onRestart,
  onCreated,
}: {
  verified: { token: string; phone: string };
  onRestart: () => void;
  onCreated: (name: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Details>({
    name: "",
    username: "",
    dob: "",
    gender: null,
    email: "",
    password: "",
    confirmation: "",
    agreed: false,
  });
  const [handleEntered, setHandleEntered] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const check = useUsernameCheck(form.username, form.name, handleEntered);
  const problems = problemsOf(form, check.status, verified.phone);

  const set = <K extends Field>(key: K, value: Details[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error?.field === key) setError(null);
  };
  const shown = (key: Field) => (error?.field === key ? error.message : submitted ? problems[key] : undefined);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.keys(problems).length > 0) {
      requestAnimationFrame(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.focus();
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setBusy(true);
    const email = form.email.trim();
    try {
      await signUp({
        verificationToken: verified.token,
        name: form.name.trim(),
        password: form.password,
        username: form.username,
        dob: form.dob,
        gender: form.gender!,
        ...(email ? { email } : {}),
      });
      onCreated(form.name.trim());
    } catch (err) {
      setError(formError(err));
      setBusy(false);
    }
  }

  const fieldErrors: Field[] = ["name", "username", "dob", "gender", "email", "password"];
  const restart = error?.code === "VERIFICATION_INVALID" || error?.code === "PHONE_TAKEN";

  return (
    <div className={styles.step} key="details">
      <div className={styles.head}>
        <h1 className={styles.title}>Tell us about yourself</h1>
        <p className={styles.lede}>Your number {prettyPhone(verified.phone)} is verified.</p>
      </div>
      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
        <AccountUsername phone={verified.phone} />
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          autoFocus
          maxLength={60}
          placeholder="Enter your full name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          error={shown("name")}
        />
        <UsernameField
          value={form.username}
          onValueChange={(v) => set("username", v)}
          onFocus={() => setHandleEntered(true)}
          check={check}
          error={error?.field === "username" ? error.message : submitted && check.status !== "taken" ? problems.username : undefined}
        />
        <Input
          label="Date of birth"
          name="bday"
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={latestDob()}
          value={form.dob}
          onChange={(e) => set("dob", e.target.value)}
          hint="You need to be 13 or older. Never shown on your profile."
          error={shown("dob")}
        />
        <div className={styles.group}>
          <span className={styles.fieldLabel} aria-hidden>
            Gender
          </span>
          <Segmented
            label="Gender"
            options={GENDERS}
            value={form.gender}
            onChange={(v) => set("gender", v)}
            invalid={Boolean(shown("gender"))}
            aria-describedby={shown("gender") ? "gender-error" : undefined}
          />
          {shown("gender") && (
            <p id="gender-error" className={styles.fieldError} role="alert">
              {shown("gender")}
            </p>
          )}
        </div>
        <Input
          label="Email (optional)"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          error={shown("email")}
        />
        <NewPasswordFields
          password={form.password}
          confirmation={form.confirmation}
          onPasswordChange={(v) => set("password", v)}
          onConfirmationChange={(v) => set("confirmation", v)}
          phone={verified.phone}
          submitted={submitted}
          error={shown("password")}
        />
        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={form.agreed}
            onChange={(e) => set("agreed", e.target.checked)}
            aria-invalid={shown("agreed") ? true : undefined}
          />
          <span className={styles.inline}>
            I agree to the <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>
          </span>
        </label>
        {shown("agreed") && (
          <p className={styles.consentError} role="alert">
            {shown("agreed")}
          </p>
        )}
        {error && !fieldErrors.includes(error.field as Field) && (
          <p className={styles.formError} role="alert">
            {error.message}
            {restart && (
              <>
                {" "}
                <button type="button" className={styles.textButton} onClick={onRestart}>
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

/** Optional, straight after the account is created. */
function AddPhoto({ name, onDone }: { name: string; onDone: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div className={styles.step} key="photo">
      <div className={styles.head}>
        <h1 className={styles.title}>Add a profile photo</h1>
        <p className={styles.lede}>It helps people know it is you. You can change it any time.</p>
      </div>
      <PhotoPicker name={name} url={url} size={120} layout="stack" onChange={(user) => setUrl(user.avatarUrl)} onSignedOut={onDone} />
      <div className={styles.actions}>
        {url ? (
          <Button size="lg" block onClick={onDone}>
            Continue
          </Button>
        ) : (
          <button type="button" className={`${styles.textButton} ${styles.skip}`} onClick={onDone}>
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

function Created({ name }: { name: string }) {
  const first = name.split(/\s+/)[0];
  return (
    <div className={`${styles.step} ${styles.success}`} key="done">
      <SuccessBadge />
      <div className={styles.head}>
        <h1 className={styles.title}>You&apos;re in, {first}</h1>
        <p className={styles.lede}>Your Ruxstar account is ready. Add a bio and your city any time from your profile.</p>
      </div>
      <div className={styles.actions}>
        <ButtonLink href={nextPath("/")} replace size="lg" block>
          Start exploring
        </ButtonLink>
        <ButtonLink href="/account" replace size="lg" block variant="secondary">
          Go to my profile
        </ButtonLink>
      </div>
    </div>
  );
}
