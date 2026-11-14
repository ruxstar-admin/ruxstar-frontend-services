"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Icon } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { useNearEnd, usePages } from "@/components/social/use-pages";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { listTickets, setSupportPass, type SupportPass } from "@/lib/api/support";
import { supportBase, supportErrorText } from "@/lib/support";
import social from "@/components/social/social.module.css";
import { TicketRow, useHoldPass } from "./Parts";
import styles from "./support.module.css";

/** On the pages an account on hold reaches, once its pass has run out or the page was reloaded. */
export function PassEnded() {
  return (
    <Empty title="Sign in to message support">
      <p>For your security, support access ends after a while.</p>
      <ButtonLink href="/signin" variant="secondary">
        Sign in
      </ButtonLink>
    </Empty>
  );
}

function Tickets({ hold, pass }: { hold: boolean; pass: SupportPass | null }) {
  const onSignedOut = useOnSignedOut();
  const base = supportBase(hold);
  const { items, loading, loadingMore, hasMore, error, more, reload } = usePages((cursor?: string) => listTickets(pass?.token, cursor));
  const sentinel = useNearEnd(more, hasMore && !error);

  useEffect(() => {
    if (error && !hold) onSignedOut(error);
  }, [error, hold, onSignedOut]);

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{hold ? "Account on hold" : "Help & support"}</h1>
        <ButtonLink href={hold ? `${base}/new?category=account` : `${base}/new`} icon={<Icon name="chat" size={16} />}>
          Message support
        </ButtonLink>
      </div>
      {hold && pass ? (
        <div className={styles.news} role="status">
          <strong>{pass.message}</strong>
          <p className={styles.small}>You can still message the Ruxstar team here.</p>
        </div>
      ) : (
        <p className={styles.small}>Questions about orders, payments, verification or your account. The Ruxstar team usually answers within a day.</p>
      )}

      {loading ? (
        <SkeletonRows count={3} />
      ) : error && items.length === 0 ? (
        <div className={social.failed} role="alert">
          <p>{supportErrorText(error, hold)}</p>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <Empty title="No tickets yet">
          <p>When you message support, the conversation shows up here.</p>
        </Empty>
      ) : (
        <ul className={styles.rows}>
          {items.map((t) => (
            <TicketRow key={t.id} href={`${base}/${t.id}`} ticket={t} />
          ))}
          {hasMore && <li ref={sentinel} className={social.sentinel} aria-hidden />}
          {loadingMore && <SkeletonRows count={1} />}
        </ul>
      )}

      {hold && (
        <p className={styles.small}>
          <a className={styles.link} href="/signin" onClick={() => setSupportPass(null)}>
            Back to sign in
          </a>
        </p>
      )}
    </div>
  );
}

/** Your help tickets, latest activity first. Signed out with a support pass (an account on hold), it is all they reach. */
export function SupportList({ hold = false }: { hold?: boolean }) {
  const pass = useHoldPass(hold);
  if (hold && pass === undefined) return <SkeletonRows count={3} />;
  if (hold && !pass) return <PassEnded />;
  return <Tickets hold={hold} pass={pass ?? null} />;
}
