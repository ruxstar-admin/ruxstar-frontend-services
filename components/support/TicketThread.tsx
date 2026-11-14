"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Icon, Tag } from "@/components/ui";
import { Empty } from "@/components/social/PostList";
import { useOnSignedOut } from "@/components/social/session";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import { getTicket, replyToTicket, resolveTicket, type TicketDetail } from "@/lib/api/support";
import { CATEGORY_LABEL, contactSupport, PHOTOS_MAX, reopenLine, STATUS, supportBase, supportErrorText, TEXT_MAX } from "@/lib/support";
import { attachPhotos, MessageBubble, PickedPhotos, useHoldPass } from "./Parts";
import { PassEnded } from "./SupportList";
import styles from "./support.module.css";

/** While the thread is open, it checks for a reply this often. */
const POLL_MS = 30_000;

function Composer({ ticket, token, hold, onSent }: { ticket: TicketDetail; token: string | undefined; hold: boolean; onSent: (next: TicketDetail) => void }) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      let next = await replyToTicket(token, ticket.id, body, key.current);
      key.current = newIdempotencyKey();
      setText("");
      onSent(next);
      try {
        next = await attachPhotos(token, next, photos);
        onSent(next);
      } catch {
        setError("Your message was sent, but a photo did not upload. Send it again in a new message.");
      }
      setPhotos([]);
    } catch (err) {
      setError(supportErrorText(err, hold));
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label className={styles.label} htmlFor="support-reply">
        {ticket.status === "resolved" ? "Reply to reopen" : "Reply"}
      </label>
      <textarea
        id="support-reply"
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={TEXT_MAX}
        placeholder="Write a reply"
        disabled={sending}
      />
      <PickedPhotos files={photos} onChange={(files) => setPhotos(files.slice(0, PHOTOS_MAX))} disabled={sending} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={sending} disabled={!text.trim()} icon={<Icon name="send" size={16} />}>
          Send
        </Button>
      </div>
    </form>
  );
}

function Thread({ id, hold, token }: { id: string; hold: boolean; token: string | undefined }) {
  const onSignedOut = useOnSignedOut();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirming, setConfirming] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const resolveKey = useRef(newIdempotencyKey());
  const closed = ticket?.status === "closed";

  const load = useCallback(
    () =>
      getTicket(token, id).then(
        (t) => {
          setTicket(t);
          setError(null);
        },
        (err) => !(hold ? false : onSignedOut(err)) && setError(err),
      ),
    [id, token, hold, onSignedOut],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (closed) return;
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [closed, load]);

  const resolve = async () => {
    setResolving(true);
    setFailure(null);
    try {
      setTicket(await resolveTicket(token, id, resolveKey.current));
      resolveKey.current = newIdempotencyKey();
    } catch (err) {
      setFailure(supportErrorText(err, hold));
    } finally {
      setResolving(false);
      setConfirming(false);
    }
  };

  if (!ticket) {
    if (!error) return <SkeletonRows count={4} />;
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Empty title={gone ? "Ticket not found" : "Could not load this ticket"}>
        <p>{supportErrorText(error, hold)}</p>
        {gone ? (
          <ButtonLink href={supportBase(hold)} variant="secondary">
            Your tickets
          </ButtonLink>
        ) : (
          <Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>
            Try again
          </Button>
        )}
      </Empty>
    );
  }

  const status = STATUS[ticket.status];
  const reopen = reopenLine(ticket.status, ticket.reopenUntil);
  const live = ticket.status === "open" || ticket.status === "waiting";

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>{ticket.subject}</h1>
          <p className={styles.small}>{[ticket.number, CATEGORY_LABEL[ticket.category], ticket.context?.label].filter(Boolean).join(" · ")}</p>
        </div>
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      {failure && (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      )}

      <ol className={styles.thread}>
        {ticket.messages.map((m) => (
          <MessageBubble key={m.id} text={m.text} photos={m.photos} at={m.at} mine={m.mine} byline={m.from === "staff" ? "Ruxstar support" : "You"} />
        ))}
      </ol>

      {ticket.status === "open" && <p className={styles.faint}>The Ruxstar team will reply here. We will let you know when they do.</p>}
      {reopen && <p className={styles.faint}>{reopen}</p>}

      {!closed && <Composer ticket={ticket} token={token} hold={hold} onSent={setTicket} />}

      {closed && (
        <ButtonLink
          href={contactSupport(ticket.category, ticket.context ?? undefined, hold)}
          variant="secondary"
        >
          Open a new ticket
        </ButtonLink>
      )}

      {live &&
        (confirming ? (
          <div className={styles.news}>
            <strong>Mark as solved?</strong>
            <p className={styles.small}>You can still reply to reopen it for 7 days.</p>
            <div className={styles.actions}>
              <Button loading={resolving} onClick={() => void resolve()}>
                Mark as solved
              </Button>
              <Button variant="ghost" disabled={resolving} onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button variant="ghost" icon={<Icon name="check" size={16} />} onClick={() => setConfirming(true)}>
              My problem is solved
            </Button>
          </div>
        ))}
    </div>
  );
}

/** One help ticket: the conversation with the Ruxstar team, a reply box, and "My problem is solved". */
export function TicketThread({ id, hold = false }: { id: string; hold?: boolean }) {
  const pass = useHoldPass(hold);
  if (hold && pass === undefined) return <SkeletonRows count={4} />;
  if (hold && !pass) return <PassEnded />;
  return <Thread id={id} hold={hold} token={pass?.token} />;
}
