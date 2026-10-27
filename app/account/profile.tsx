"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { nameProblem } from "@/components/auth/fields";
import { Button, Icon, Input, useToast } from "@/components/ui";
import { checkUsername, cityAt, formError, updateMe, type FormError, type User } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import styles from "./account.module.css";

const HANDLE = /^[a-z0-9_.]{3,20}$/;

type Handle =
  | { state: "idle" | "checking" | "mine" }
  | { state: "invalid" | "available" | "taken" };

/** A stable pale tint per person, from their id. */
const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

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

export function ProfilePanel({ user, onSaved, onSignedOut }: { user: User; onSaved: (u: User) => void; onSignedOut: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, username: user.username, city: user.city ?? "" });
  const [handle, setHandle] = useState<Handle>({ state: "mine" });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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

  const changes = {
    ...(form.name.trim() !== user.name ? { name: form.name.trim() } : {}),
    ...(typed !== user.username ? { username: typed } : {}),
    ...(form.city.trim() !== (user.city ?? "") ? { city: form.city.trim() || null } : {}),
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
      if (err instanceof ApiError && err.status === 401) return onSignedOut();
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
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe(changes);
      onSaved(updated);
      setForm({ name: updated.name, username: updated.username, city: updated.city ?? "" });
      setLocated(null);
      toast("Profile saved.", "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onSignedOut();
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
  const hue = hueOf(user.id);
  const shownName = form.name.trim() || "Your name";

  return (
    <form className={styles.panel} onSubmit={save} noValidate>
      <div className={styles.preview} aria-label="How others see you">
        <span className={styles.avatar} style={{ "--hue": hue } as React.CSSProperties} aria-hidden>
          {shownName.charAt(0).toUpperCase()}
        </span>
        <div className={styles.previewText}>
          <p className={styles.previewName}>{shownName}</p>
          <p className={styles.muted}>
            @{typed || user.username}
            {form.city.trim() && ` · ${form.city.trim()}`}
          </p>
        </div>
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

      {error && !["name", "username", "city"].includes(error.field ?? "") && (
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
