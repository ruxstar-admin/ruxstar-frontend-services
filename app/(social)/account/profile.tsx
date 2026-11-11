"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CodeField, nameProblem, validEmail } from "@/components/auth/fields";
import { PhotoPicker } from "@/components/profile/PhotoPicker";
import { Button, Icon, Input, Segmented, useToast } from "@/components/ui";
import {
  checkUsername,
  cityAt,
  formError,
  isSignedOut,
  sendEmailCode,
  updateMe,
  verifyEmail,
  type FormError,
  type Gender,
  type User,
} from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import styles from "./account.module.css";

const HANDLE = /^[a-z0-9_.]{3,20}$/;
const BIO_MAX = 160;
const BIO_LINES = 4;

/** One empty line in a row at most, and no fifth line; the API applies the same rule. */
function limitBio(text: string) {
  const lines = text.replace(/\n{3,}/g, "\n\n").split("\n");
  if (lines.length <= BIO_LINES) return lines.join("\n");
  const rest = lines.slice(BIO_LINES - 1).filter(Boolean).join(" ");
  return [...lines.slice(0, BIO_LINES - 1), rest].join("\n");
}
const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
] as const satisfies readonly { value: Gender; label: string }[];

type Handle =
  | { state: "idle" | "checking" | "mine" }
  | { state: "invalid" | "available" | "taken" };

function geolocate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
  });
}

const locateMessage = (err: unknown) => {
  if (err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED) {
    return "Location is blocked for this site. Allow it in the browser, or type your city.";
  }
  if (err instanceof ApiError) return formError(err).message;
  return "Could not get your location. Type your city instead.";
};

const formOf = (user: User) => ({
  name: user.name,
  username: user.username,
  city: user.city ?? "",
  email: user.email ?? "",
  bio: user.bio ?? "",
  gender: user.gender,
});

export function ProfilePanel({ user, onSaved, onSignedOut }: { user: User; onSaved: (u: User) => void; onSignedOut: () => void }) {
  const toast = useToast();
  const bioId = useId();
  const [form, setForm] = useState(() => formOf(user));
  const [handle, setHandle] = useState<Handle>({ state: "mine" });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const latest = useRef(0);

  const typed = form.username.trim().toLowerCase();

  useEffect(() => {
    const ticket = ++latest.current;
    if (typed === user.username) {
      setHandle({ state: "mine" });
      checkUsername().then((r) => ticket === latest.current && setSuggestions(r.suggestions), () => {});
      return;
    }
    if (!HANDLE.test(typed)) {
      setHandle({ state: "invalid" });
      return;
    }
    setHandle({ state: "checking" });
    const timer = setTimeout(() => {
      checkUsername(typed).then(
        (r) => {
          if (ticket !== latest.current) return;
          setHandle({ state: r.available ? "available" : "taken" });
          setSuggestions(r.suggestions);
        },
        () => ticket === latest.current && setHandle({ state: "idle" }),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [typed, user.username]);

  const email = form.email.trim();
  const bio = form.bio.trim();
  const changes = {
    ...(form.name.trim() !== user.name ? { name: form.name.trim() } : {}),
    ...(typed !== user.username ? { username: typed } : {}),
    ...(form.city.trim() !== (user.city ?? "") ? { city: form.city.trim() || null } : {}),
    ...(email !== (user.email ?? "") ? { email: email || null } : {}),
    ...(bio !== (user.bio ?? "") ? { bio: bio || null } : {}),
    ...(form.gender !== user.gender && form.gender ? { gender: form.gender } : {}),
  };
  const dirty = Object.keys(changes).length > 0;

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const { coords } = await geolocate();
      const found = await cityAt(coords.latitude, coords.longitude);
      if (!found.city) {
        setError({ message: "We could not name a city there. Type it instead.", field: "city" });
      } else {
        setForm((f) => ({ ...f, city: found.city! }));
        setLocated(found.attribution);
      }
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      setError({ message: locateMessage(err), field: "city" });
    } finally {
      setLocating(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const badName = nameProblem(form.name);
    if (badName) return setError({ message: badName, field: "name" });
    if (handle.state === "invalid") return setError({ message: "Use 3 to 20 lowercase letters, numbers, dots or underscores.", field: "username" });
    if (handle.state === "taken") return setError({ message: "That username is taken. Pick one of the suggestions.", field: "username" });
    if (!validEmail(email)) return setError({ message: "Enter a valid email address.", field: "email" });
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe(changes);
      onSaved(updated);
      setForm(formOf(updated));
      setLocated(null);
      setVerifying(false);
      toast("Profile saved.", "success");
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      setError(formError(err));
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const handleNote = {
    idle: undefined,
    mine: "This is your username now.",
    checking: "Checking…",
    available: `@${typed} is free.`,
    invalid: "3 to 20 lowercase letters, numbers, dots or underscores.",
    taken: undefined,
  }[handle.state];
  const emailSaved = email === (user.email ?? "");
  const emailNote = !email
    ? undefined
    : !emailSaved
      ? "Save, then verify it with a code we email you."
      : user.emailVerified
        ? "Verified."
        : "Not verified.";
  const shownName = form.name.trim() || "Your name";

  return (
    <form className={styles.panel} onSubmit={save} noValidate>
      <div className={styles.preview}>
        <PhotoPicker name={shownName} url={user.avatarUrl} onChange={onSaved} onSignedOut={onSignedOut} />
        <p className={styles.muted}>
          Your public profile:{" "}
          <a className={styles.inlineLink} href={`/u/${user.username}`} target="_blank" rel="noopener">
            ruxstar.com/u/{user.username}
          </a>
        </p>
      </div>

      <Input
        label="Name"
        name="name"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={60}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={fieldError("name")}
      />

      <div className={styles.group}>
        <Input
          label="Username"
          name="username"
          prefix="@"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
          hint={handleNote}
          error={fieldError("username") ?? (handle.state === "taken" ? `@${typed} is taken.` : undefined)}
        />
        {suggestions.length > 0 && (
          <div className={styles.suggestions} role="group" aria-label="Free usernames">
            <span className={styles.muted}>Free:</span>
            {suggestions.map((s) => (
              <button key={s} type="button" className={styles.chip} onClick={() => setForm({ ...form, username: s })}>
                @{s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.group}>
        <div className={styles.fieldHead}>
          <label htmlFor={bioId} className={styles.fieldLabel}>
            Bio
          </label>
          <span className={styles.count} aria-hidden>
            {form.bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          id={bioId}
          name="bio"
          className={styles.textarea}
          rows={3}
          maxLength={BIO_MAX}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: limitBio(e.target.value) })}
          aria-invalid={fieldError("bio") ? true : undefined}
          aria-describedby={`${bioId}-note`}
        />
        <p id={`${bioId}-note`} className={fieldError("bio") ? styles.fieldError : styles.muted}>
          {fieldError("bio") ?? `Up to ${BIO_MAX} characters and ${BIO_LINES} lines.`}
        </p>
      </div>

      <Input
        label="City"
        name="city"
        autoComplete="address-level2"
        maxLength={60}
        value={form.city}
        onChange={(e) => {
          setForm({ ...form, city: e.target.value });
          setLocated(null);
        }}
        hint={located ? `Found from your location. Map data ${located}.` : "Where you usually book and order."}
        error={fieldError("city")}
        suffix={
          <button type="button" className={styles.locate} onClick={locate} disabled={locating} aria-busy={locating || undefined}>
            <Icon name="map-pin" size={16} />
            {locating ? "Finding…" : "Use my location"}
          </button>
        }
      />

      <div className={styles.group}>
        <Input
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => {
            setForm({ ...form, email: e.target.value });
            setVerifying(false);
          }}
          hint={emailNote}
          error={fieldError("email")}
          suffix={emailSaved && user.email && user.emailVerified ? <Icon name="check" size={18} /> : undefined}
        />
        {emailSaved && user.email && !user.emailVerified && !verifying && (
          <div>
            <button type="button" className={styles.textButton} onClick={() => setVerifying(true)}>
              Verify now
            </button>
          </div>
        )}
        {verifying && emailSaved && user.email && (
          <EmailVerify
            onVerified={(updated) => {
              onSaved(updated);
              setVerifying(false);
              toast("Email verified.", "success");
            }}
            onCancel={() => setVerifying(false)}
            onSignedOut={onSignedOut}
          />
        )}
      </div>

      <div className={styles.group}>
        <span className={styles.fieldLabel} aria-hidden>
          Gender
        </span>
        <Segmented label="Gender" options={GENDERS} value={form.gender} onChange={(gender) => setForm({ ...form, gender })} />
      </div>

      <p className={styles.muted}>Your email, phone and gender are never shown on your profile.</p>

      {error && !["name", "username", "city", "email", "bio"].includes(error.field ?? "") && (
        <p className={styles.formError} role="alert">
          {error.message}
        </p>
      )}
      <div className={styles.panelFoot}>
        {!dirty && <span className={styles.muted}>No changes yet</span>}
        <Button type="submit" loading={saving} disabled={!dirty || handle.state === "checking"}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

/** Emails a code as soon as it opens, then checks it. Lives inside the profile form, so it uses no form of its own. */
function EmailVerify({
  onVerified,
  onCancel,
  onSignedOut,
}: {
  onVerified: (user: User) => void;
  onCancel: () => void;
  onSignedOut: () => void;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const sent = await sendEmailCode();
      setSentTo(sent.sentTo);
      setResendAt(Date.now() + sent.resendInSeconds * 1000);
      setNow(Date.now());
      setCode("");
      requestAnimationFrame(() => codeRef.current?.focus());
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      setError(formError(err));
    } finally {
      setSending(false);
    }
  }

  // Sends once when it opens; the resend button handles the rest.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send();
  });

  useEffect(() => {
    if (Date.now() >= resendAt) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function check(value: string) {
    if (value.length !== 6) return setError({ message: "Enter the 6-digit code from the email.", field: "code" });
    setChecking(true);
    setError(null);
    try {
      onVerified(await verifyEmail(value));
    } catch (err) {
      if (isSignedOut(err)) return onSignedOut();
      const problem = formError(err);
      setError(problem.code === "OTP_INVALID" ? { ...problem, field: "code" } : problem);
      setChecking(false);
      if (problem.code === "OTP_INVALID") {
        setCode("");
        requestAnimationFrame(() => codeRef.current?.focus());
      }
    }
  }

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  return (
    <div className={styles.verify} role="group" aria-label="Verify your email">
      <p className={styles.muted} aria-live="polite">
        {sending && !sentTo ? "Sending a code…" : sentTo ? `We sent a 6-digit code to ${sentTo}.` : null}
      </p>
      {sentTo && (
        <CodeField
          ref={codeRef}
          value={code}
          onValueChange={(value) => {
            setCode(value);
            if (value.length === 6 && !checking) void check(value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void check(code);
          }}
          error={error?.field === "code" ? error.message : undefined}
        />
      )}
      {error && error.field !== "code" && (
        <p className={styles.formError} role="alert">
          {error.message}
        </p>
      )}
      <div className={styles.verifyActions}>
        <button type="button" className={styles.textButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.textButton} disabled={wait > 0 || sending} onClick={() => void send()}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
        {sentTo && (
          <Button type="button" variant="secondary" loading={checking} onClick={() => void check(code)}>
            Verify
          </Button>
        )}
      </div>
    </div>
  );
}
