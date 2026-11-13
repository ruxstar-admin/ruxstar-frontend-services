"use client";

import { useState } from "react";
import { Avatar } from "@/components/profile/Avatar";
import { useOnSignedOut } from "@/components/social/session";
import { Button } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { acceptInvite, declineInvite, inviteEnds, permissionsLine, type PermissionInfo, type WorkInvite } from "@/lib/api/team";
import styles from "./team.module.css";

/** A team invite with Accept and Decline. `onAnswered` runs after either succeeds. Same as the app. */
export function InviteCard({ invite, catalog, onAnswered }: { invite: WorkInvite; catalog: PermissionInfo[]; onAnswered: (accepted: boolean) => void }) {
  const onSignedOut = useOnSignedOut();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (accept: boolean) => {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      await (accept ? acceptInvite(invite.id) : declineInvite(invite.id));
      onAnswered(accept);
    } catch (err) {
      if (!onSignedOut(err)) setError(formError(err).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.invite}>
      <div className={styles.inviteHead}>
        <Avatar name={invite.business.name} url={invite.business.photo} size={44} />
        <span className={styles.text}>
          <span className={styles.name}>{invite.business.name}</span>
          <span className={styles.line}>
            {invite.owner.name} invited you{invite.business.city ? ` · ${invite.business.city}` : ""}
          </span>
        </span>
      </div>
      <p>You&apos;d be able to: {permissionsLine(catalog, invite.permissions)}</p>
      <p className={styles.muted}>{inviteEnds(invite.expiresAt)}</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <Button variant="secondary" loading={busy === "decline"} disabled={!!busy} onClick={() => void answer(false)}>
          Decline
        </Button>
        <Button loading={busy === "accept"} disabled={!!busy} onClick={() => void answer(true)}>
          Accept
        </Button>
      </div>
    </section>
  );
}
