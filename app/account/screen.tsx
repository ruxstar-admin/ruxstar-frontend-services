"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Input, Skeleton, Tag, useToast } from "@/components/ui";
import {
  endSession,
  formError,
  getMe,
  listSessions,
  signOut,
  updateMe,
  type DeviceSession,
  type FormError,
  type User,
} from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import styles from "./account.module.css";

const seen = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

function lastSeen(iso: string, current: boolean) {
  if (current) return "Active now";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes > -60) return `Active ${seen.format(minutes, "minute")}`;
  if (minutes > -60 * 24) return `Active ${seen.format(Math.round(minutes / 60), "hour")}`;
  return `Active ${seen.format(Math.round(minutes / 1440), "day")}`;
}

const prettyPhone = (e164: string) => `${e164.slice(0, 3)} ${e164.slice(3, 8)} ${e164.slice(8)}`;

export function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [form, setForm] = useState({ name: "", username: "", city: "" });
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const toSignIn = useCallback(() => router.replace("/signin?next=/account"), [router]);

  useEffect(() => {
    let live = true;
    Promise.all([getMe(), listSessions()])
      .then(([me, sessions]) => {
        if (!live) return;
        setUser(me);
        setForm({ name: me.name, username: me.username, city: me.city ?? "" });
        setDevices(sessions);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) toSignIn();
        else if (live) toast(formError(err).message, "danger");
      });
    return () => {
      live = false;
    };
  }, [toSignIn, toast]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const changes: { name?: string; username?: string; city?: string | null } = {};
    if (form.name.trim() !== user.name) changes.name = form.name.trim();
    if (form.username.trim() !== user.username) changes.username = form.username.trim().toLowerCase();
    if (form.city.trim() !== (user.city ?? "")) changes.city = form.city.trim() || null;
    if (!Object.keys(changes).length) return toast("Nothing to save.");
    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe(changes);
      setUser(updated);
      toast("Saved.", "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return toSignIn();
      setError(formError(err));
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    try {
      await endSession(id);
      setDevices((list) => list?.filter((d) => d.id !== id) ?? null);
      toast("That device is signed out.", "success");
    } catch (err) {
      toast(formError(err).message, "danger");
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      router.replace("/signin");
    }
  }

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
        <Button variant="ghost" onClick={leave} loading={leaving} disabled={!user}>
          Sign out
        </Button>
      </header>

      <main className={styles.main} aria-busy={!user}>
        <h1 className={styles.title}>{user ? `Hi, ${user.name.split(" ")[0]}` : <Skeleton width={220} height={38} />}</h1>

        <section className={styles.section} aria-labelledby="profile">
          <div className={styles.sectionHead}>
            <h2 id="profile" className={styles.sectionTitle}>
              Profile
            </h2>
            <p className={styles.muted}>{user ? prettyPhone(user.phone) : <Skeleton width={140} />}</p>
          </div>
          {user ? (
            <form className={styles.form} onSubmit={save} noValidate>
              <Input
                label="Name"
                autoComplete="name"
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={fieldError("name")}
              />
              <Input
                label="Username"
                prefix="@"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                hint="Lowercase letters, numbers, dots and underscores."
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                error={fieldError("username")}
              />
              <Input
                label="City"
                autoComplete="address-level2"
                maxLength={60}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                error={fieldError("city")}
              />
              {error && !["name", "username", "city"].includes(error.field ?? "") && (
                <p className={styles.formError} role="alert">
                  {error.message}
                </p>
              )}
              <div>
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.form}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={48} radius={10} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="devices">
          <div className={styles.sectionHead}>
            <h2 id="devices" className={styles.sectionTitle}>
              Signed-in devices
            </h2>
            <p className={styles.muted}>Sign out anything you do not recognise.</p>
          </div>
          <ul className={styles.devices}>
            {devices
              ? devices.map((d) => (
                  <li key={d.id} className={styles.device}>
                    <div>
                      <p className={styles.deviceName}>
                        {d.label} {d.current && <Tag tone="solid">This device</Tag>}
                      </p>
                      <p className={styles.muted}>{lastSeen(d.lastSeenAt, d.current)}</p>
                    </div>
                    {!d.current && (
                      <Button variant="secondary" onClick={() => revoke(d.id)}>
                        Sign out
                      </Button>
                    )}
                  </li>
                ))
              : [0, 1].map((i) => (
                  <li key={i} className={styles.device}>
                    <Skeleton width="60%" height={20} />
                  </li>
                ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
