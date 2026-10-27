"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { prettyPhone } from "@/components/auth/fields";
import { Button, Skeleton, Tag, useToast } from "@/components/ui";
import { endSession, formError, getMe, listSessions, signOut, type DeviceSession, type User } from "@/lib/api/account";
import { ApiError } from "@/lib/api/client";
import { ProfilePanel } from "./profile";
import styles from "./account.module.css";

const seen = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
const since = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

function lastSeen(iso: string, current: boolean) {
  if (current) return "Active now";
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes > -60) return `Active ${seen.format(minutes, "minute")}`;
  if (minutes > -60 * 24) return `Active ${seen.format(Math.round(minutes / 60), "hour")}`;
  return `Active ${seen.format(Math.round(minutes / 1440), "day")}`;
}

const isSignedOut = (err: unknown) => err instanceof ApiError && err.status === 401;

function Setting({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className={styles.setting} aria-labelledby={id}>
      <div className={styles.label}>
        <h2 id={id} className={styles.settingTitle}>
          {title}
        </h2>
        <p className={styles.muted}>{description}</p>
      </div>
      {children}
    </section>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);

  const toSignIn = useCallback(() => router.replace("/signin?next=/account"), [router]);

  useEffect(() => {
    let live = true;
    Promise.all([getMe(), listSessions()])
      .then(([me, sessions]) => {
        if (!live) return;
        setUser(me);
        setDevices(sessions);
      })
      .catch((err) => {
        if (isSignedOut(err)) toSignIn();
        else if (live) setLoadError(formError(err).message);
      });
    return () => {
      live = false;
    };
  }, [toSignIn, attempt]);

  function retry() {
    setLoadError(null);
    setAttempt((n) => n + 1);
  }

  async function revoke(device: DeviceSession) {
    if (ending) return;
    setEnding(device.id);
    try {
      await endSession(device.id);
      setDevices((list) => list?.filter((d) => d.id !== device.id) ?? null);
      toast(`${device.label} is signed out.`, "success");
    } catch (err) {
      if (isSignedOut(err)) return toSignIn();
      toast(formError(err).message, "danger");
    } finally {
      setEnding(null);
    }
  }

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
      router.replace("/signin");
    } catch (err) {
      if (isSignedOut(err)) return router.replace("/signin");
      toast(formError(err).message, "danger");
      setLeaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className="brand">
          <img src="/logo.svg" width={30} height={30} alt="" />
          <span>ruxstar</span>
        </Link>
        <Button variant="ghost" onClick={leave} loading={leaving}>
          Sign out
        </Button>
      </header>

      <main className={styles.main} aria-busy={!user && !loadError}>
        <div className={styles.head}>
          <h1 className={styles.title}>Account</h1>
          {user ? (
            <p className={styles.muted}>
              {prettyPhone(user.phone.replace(/^\+91/, ""))} · Member since {since.format(new Date(user.createdAt))}
            </p>
          ) : (
            !loadError && <Skeleton width={260} height={20} />
          )}
        </div>

        {loadError ? (
          <div className={styles.failed} role="alert">
            <p>{loadError}</p>
            <Button variant="secondary" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <Setting id="profile" title="Profile" description="How people and businesses see you on Ruxstar.">
              {user ? (
                <ProfilePanel user={user} onSaved={setUser} onSignedOut={toSignIn} />
              ) : (
                <div className={styles.panel}>
                  <div className={styles.preview}>
                    <Skeleton width={48} height={48} radius={999} />
                    <Skeleton width={180} height={20} />
                  </div>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={styles.group}>
                      <Skeleton width={72} height={16} />
                      <Skeleton height={48} radius={10} />
                    </div>
                  ))}
                </div>
              )}
            </Setting>

            <Setting id="devices" title="Signed-in devices" description="Sign out anything you do not recognise.">
              <ul className={`${styles.panel} ${styles.devices}`}>
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
                          <Button
                            variant="secondary"
                            onClick={() => revoke(d)}
                            loading={ending === d.id}
                            aria-label={`Sign out ${d.label}`}
                          >
                            Sign out
                          </Button>
                        )}
                      </li>
                    ))
                  : [0, 1].map((i) => (
                      <li key={i} className={styles.device}>
                        <div className={styles.group}>
                          <Skeleton width={160} height={20} />
                          <Skeleton width={96} height={16} />
                        </div>
                      </li>
                    ))}
              </ul>
            </Setting>
          </>
        )}
      </main>
    </div>
  );
}
