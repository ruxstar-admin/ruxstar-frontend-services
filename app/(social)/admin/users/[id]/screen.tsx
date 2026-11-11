"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Needs, useAccess, useCan } from "@/components/admin/AdminFrame";
import { Failed, Fact, ReasonForm, date, styles } from "@/components/admin/parts";
import { Avatar } from "@/components/profile/Avatar";
import { useMe, useOnSignedOut } from "@/components/social/session";
import { Button, ButtonLink, Card, Icon, Skeleton, useToast } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { getUser, signOutUser, suspendUser, unlockUser, type UserDetail } from "@/lib/api/admin";
import { ago } from "@/lib/time";
import { RoleTags, StatusTag } from "../tags";

const KYC_LABEL: Record<string, string> = {
  none: "Not started",
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Waiting for review",
  approved: "Approved",
  rejected: "Sent back",
  locked: "On hold",
  expired: "Expired",
};

type Busy = "suspend" | "unlock" | "signOut" | null;

function Actions({ user, onChanged }: { user: UserDetail; onChanged: (u: UserDetail, message: string) => void }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const me = useMe();
  const access = useAccess();
  const canManage = useCan("users.manage");
  const [suspending, setSuspending] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const keys = useRef({ suspend: crypto.randomUUID(), unlock: crypto.randomUUID(), signOut: crypto.randomUUID() });

  const why =
    user.id === me?.id
      ? "This is your own account."
      : user.roles.admin
        ? "Admins can't be changed here."
        : user.roles.ruxstarStaff && !access.admin
          ? "Only an admin can change a Ruxstar staff account."
          : user.status === "deleted"
            ? "This account was deleted."
            : null;
  if (!canManage) return null;
  if (why) return <p className={styles.muted}>{why}</p>;

  async function run(kind: Exclude<Busy, null>, reason = "") {
    setBusy(kind);
    try {
      const k = keys.current[kind];
      const done = kind === "suspend" ? await suspendUser(user.id, reason, k) : kind === "unlock" ? await unlockUser(user.id, k) : await signOutUser(user.id, k);
      keys.current[kind] = crypto.randomUUID();
      setSuspending(false);
      onChanged(done, kind === "suspend" ? "Account put on hold." : kind === "unlock" ? "Account unlocked." : "Signed out of every device.");
    } catch (err) {
      if (!onSignedOut(err)) toast(formError(err).message, "danger");
    } finally {
      setBusy(null);
    }
  }

  const locked = user.status === "locked" || !!user.signInLockedUntil;

  if (suspending) {
    return (
      <ReasonForm
        prompt="Why is this account going on hold? Keep it for the team; the person sees a general message."
        placeholder="For example: three scam reports confirmed on 10 Nov."
        confirm="Put on hold"
        busy={busy === "suspend"}
        onCancel={() => setSuspending(false)}
        onSubmit={(reason) => run("suspend", reason)}
      />
    );
  }

  return (
    <div className={styles.actions}>
      <Button variant="secondary" onClick={() => run("signOut")} loading={busy === "signOut"} disabled={!!busy || user.sessions === 0}>
        Sign out everywhere
      </Button>
      {locked && (
        <Button variant="secondary" onClick={() => run("unlock")} loading={busy === "unlock"} disabled={!!busy}>
          Unlock
        </Button>
      )}
      {user.status === "active" && (
        <Button variant="danger" onClick={() => setSuspending(true)} disabled={!!busy}>
          Put on hold
        </Button>
      )}
    </div>
  );
}

export function UserScreen({ id }: { id: string }) {
  const toast = useToast();
  const onSignedOut = useOnSignedOut();
  const canAudit = useCan("audit.view");
  const isAdmin = useAccess().admin;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getUser(id).then(
      (u) => live && setUser(u),
      (err) => live && !onSignedOut(err) && setError(err),
    );
    return () => {
      live = false;
    };
  }, [id, attempt, onSignedOut]);

  return (
    <Needs need="users.view">
      <div className={styles.page}>
        <div>
          <ButtonLink href="/admin/users" variant="ghost" icon={<Icon name="arrow-left" size={18} />}>
            People
          </ButtonLink>
        </div>

        {error ? (
          <Failed
            error={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !user ? (
          <Skeleton height={420} radius={16} />
        ) : (
          <Card as="section" padding="lg" className={styles.page}>
            <div className={styles.head}>
              <div className={styles.identity}>
                <Avatar name={user.name || user.username} url={user.avatarUrl} size={64} />
                <div>
                  <h1 className={styles.title}>{user.name || "No name"}</h1>
                  <p className={styles.muted}>
                    {user.status === "active" ? <Link href={`/u/${user.username}`}>@{user.username}</Link> : `@${user.username}`}
                  </p>
                </div>
              </div>
              <div className={styles.tags}>
                <RoleTags roles={user.roles} />
                <StatusTag status={user.status} />
              </div>
            </div>

            {user.suspension && (
              <p className={styles.note} data-tone="danger">
                On hold {ago(user.suspension.at)}
                {user.suspension.by ? ` by ${user.suspension.by.name}` : ""}: {user.suspension.reason}
              </p>
            )}
            {user.signInLockedUntil && new Date(user.signInLockedUntil) > new Date() && (
              <p className={styles.note}>Too many wrong passwords. Sign-in opens again {ago(user.signInLockedUntil)}.</p>
            )}

            <dl className={styles.facts}>
              <Fact label="Phone" value={user.phone} />
              <Fact label="Email" value={user.email ? `${user.email}${user.emailVerified ? "" : " (not confirmed)"}` : "—"} />
              <Fact label="City" value={user.city ?? "—"} />
              <Fact label="Member since" value={date(user.createdAt)} />
              <Fact label="Ruxstar Card" value={user.card ?? "—"} />
              <Fact label="Identity check" value={KYC_LABEL[user.kyc.base] ?? user.kyc.base} />
              <Fact label="Posts" value={String(user.stats.posts)} />
              <Fact label="Signed in on" value={user.sessions === 1 ? "1 device" : `${user.sessions} devices`} />
              <Fact label="Open reports on posts" value={String(user.openReports)} warn={user.openReports > 0} />
              {user.staff && (
                <Fact
                  label="Ruxstar staff"
                  value={isAdmin ? <Link href="/admin/staff">{user.staff.title}</Link> : user.staff.title}
                  warn={user.staff.status !== "active"}
                />
              )}
              <Fact label="Account id" value={user.id} />
            </dl>

            {user.bio && <p className={styles.text}>{user.bio}</p>}

            <Actions
              user={user}
              onChanged={(u, message) => {
                setUser(u);
                toast(message, "success");
              }}
            />

            {canAudit && (
              <div>
                <ButtonLink href={`/admin/audit?target=${user.id}`} variant="ghost" icon={<Icon name="clock" size={18} />}>
                  History for this account
                </ButtonLink>
              </div>
            )}
          </Card>
        )}
      </div>
    </Needs>
  );
}
