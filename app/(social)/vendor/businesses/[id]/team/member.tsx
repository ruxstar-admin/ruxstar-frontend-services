"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { PermissionPicker } from "@/components/team/PermissionPicker";
import { Button, ButtonLink, Icon, Input, Tag } from "@/components/ui";
import { Back, Failed, Loading } from "@/components/vendor/parts";
import { useLoad } from "@/components/vendor/use-load";
import { formError } from "@/lib/api/account";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  MEMBER_STATUS,
  USERNAME,
  cleanUsername,
  getTeam,
  inviteEnds,
  inviteToTeam,
  removeMember,
  setMemberPermissions,
  type Team,
  type TeamMember,
  type TeamPermission,
} from "@/lib/api/team";
import team from "@/components/team/team.module.css";
import styles from "@/components/vendor/vendor.module.css";

const retryable = (err: unknown) => err instanceof ApiError && err.status === 0;

function Invite({ businessId, data }: { businessId: string; data: Team }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const [username, setUsername] = useState("");
  const [permissions, setPermissions] = useState<TeamPermission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; banner?: string } | null>(null);
  const key = useRef(newIdempotencyKey());
  const clean = cleanUsername(username);
  const ready = USERNAME.test(clean) && permissions.length > 0;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await inviteToTeam(businessId, clean, permissions, key.current);
      router.push(`/vendor/businesses/${businessId}/team`);
    } catch (err) {
      setBusy(false);
      if (onSignedOut(err)) return;
      if (!retryable(err)) key.current = newIdempotencyKey();
      const problem = formError(err);
      setError(problem.field === "username" ? { field: problem.message } : { banner: problem.message });
    }
  };

  return (
    <div className={styles.page}>
      <Back href={`/vendor/businesses/${businessId}/team`}>Team</Back>
      <h1 className={styles.title}>Invite someone</h1>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) void send();
        }}
      >
        <Input
          label="Their Ruxstar username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (error?.field) setError(null);
          }}
          placeholder="@username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={21}
          error={error?.field}
          hint="They get a notification and have 7 days to accept."
        />
        <h2 className={team.section}>What they can do</h2>
        <PermissionPicker catalog={data.permissions} value={permissions} onChange={setPermissions} />
        {error?.banner && (
          <p className={styles.error} role="alert">
            {error.banner}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="lg" loading={busy} disabled={!ready}>
            Send invite
          </Button>
        </div>
      </form>
    </div>
  );
}

function Member({ businessId, data, member }: { businessId: string; data: Team; member: TeamMember }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const [permissions, setPermissions] = useState(member.permissions);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invited = member.status === "invited";
  const changed = permissions.join() !== member.permissions.join();
  const status = MEMBER_STATUS[member.status];
  const back = `/vendor/businesses/${businessId}/team`;

  const run = async (kind: "save" | "remove") => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "save") await setMemberPermissions(businessId, member.id, permissions);
      else await removeMember(businessId, member.id);
      router.push(back);
    } catch (err) {
      setBusy(null);
      setConfirming(false);
      if (!onSignedOut(err)) setError(formError(err).message);
    }
  };

  return (
    <div className={styles.page}>
      <Back href={back}>Team</Back>
      <div className={styles.head}>
        <div className={team.inviteHead}>
          <Avatar name={member.person.name} url={member.person.avatar} size={56} />
          <div className={styles.identity}>
            <h1 className={styles.name}>{member.person.name}</h1>
            {member.person.username && <p className={styles.muted}>@{member.person.username}</p>}
          </div>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      {member.status === "waiting" ? (
        <p className={styles.muted}>They joined, but nothing works for them until their identity verification is approved.</p>
      ) : invited && member.expiresAt ? (
        <p className={styles.muted}>{inviteEnds(member.expiresAt)}. You can change what they&apos;ll be able to do before they accept.</p>
      ) : null}
      <h2 className={team.section}>What they can do</h2>
      <PermissionPicker catalog={data.permissions} value={permissions} onChange={setPermissions} disabled={!!busy} />
      {permissions.length === 0 && <p className={styles.warn}>Pick at least one, or remove them from the team.</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {confirming ? (
        <div className={styles.note} data-tone="danger">
          <Icon name="trash" size={20} />
          <div className={styles.form}>
            <span>
              <strong>{invited ? "Cancel this invite?" : `Remove ${member.person.name}?`}</strong>{" "}
              {invited ? "They won't be able to accept it." : "Their access ends at once. They'll be told."}
            </span>
            <div className={styles.actions}>
              <Button variant="danger" loading={busy === "remove"} onClick={() => void run("remove")}>
                {invited ? "Cancel invite" : "Remove"}
              </Button>
              <Button variant="ghost" disabled={busy === "remove"} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button size="lg" loading={busy === "save"} disabled={!changed || permissions.length === 0 || !!busy} onClick={() => void run("save")}>
            Save changes
          </Button>
          {!invited && (
            <Link
              href={`/vendor/businesses/${businessId}/activity?${new URLSearchParams({ by: member.person.id, name: member.person.name })}`}
              className={styles.link}
            >
              See what they did
            </Link>
          )}
          <button type="button" className={styles.link} data-muted onClick={() => setConfirming(true)}>
            {invited ? "Cancel this invite" : "Remove from the team"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Invites someone (no `memberId`), or changes what one person may do and removes them. Same as the app. */
export function MemberScreen({ id, memberId }: { id: string; memberId?: string }) {
  const { data, error, reload } = useLoad(() => getTeam(id), id);
  if (error && !data) return <Failed error={error} onRetry={reload} />;
  if (!data) return <Loading rows={3} />;
  if (!memberId) return <Invite businessId={id} data={data} />;
  const member = data.members.find((m) => m.id === memberId);
  if (member) return <Member key={member.id} businessId={id} data={data} member={member} />;
  return (
    <Empty title="Not on the team">
      <p>They left, were removed, or their invite ran out.</p>
      <ButtonLink href={`/vendor/businesses/${id}/team`} variant="secondary">
        Team
      </ButtonLink>
    </Empty>
  );
}
