"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Icon, Input } from "@/components/ui";
import { useOnSignedOut } from "@/components/social/session";
import { SkeletonRows } from "@/app/(social)/notifications/screen";
import { newIdempotencyKey } from "@/lib/api/client";
import { createTicket, type ContextType, type SupportCategory, type TicketDetail } from "@/lib/api/support";
import { CATEGORIES, CONTEXT_TYPES, isCategory, SUBJECT_MAX, SUBJECT_MIN, supportBase, supportErrorText, TEXT_MAX } from "@/lib/support";
import { attachPhotos, PickedPhotos, useHoldPass } from "./Parts";
import { PassEnded } from "./SupportList";
import styles from "./support.module.css";

/** What a "Contact support" link fills in; `label` is shown on the form only, the API writes its own. */
export interface NewTicketParams {
  category?: string;
  type?: string;
  id?: string;
  label?: string;
}

function Form({ hold, token, params }: { hold: boolean; token: string | undefined; params: NewTicketParams }) {
  const router = useRouter();
  const onSignedOut = useOnSignedOut();
  const context =
    params.type && params.id && (CONTEXT_TYPES as readonly string[]).includes(params.type)
      ? { type: params.type as ContextType, id: params.id, label: params.label }
      : null;
  const [category, setCategory] = useState<SupportCategory | "">(isCategory(params.category ?? null) ? (params.category as SupportCategory) : "");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  const canSend = !!category && subject.trim().length >= SUBJECT_MIN && text.trim().length > 0;

  const send = async () => {
    if (!category || !canSend) return;
    setSending(true);
    setError(null);
    let created: TicketDetail;
    try {
      created = await createTicket(
        token,
        { category, subject: subject.trim(), text: text.trim(), ...(context ? { context: { type: context.type, id: context.id } } : {}) },
        key.current,
      );
    } catch (err) {
      setSending(false);
      if (!hold && onSignedOut(err)) return;
      setError(supportErrorText(err, hold));
      return;
    }
    key.current = newIdempotencyKey();
    // The ticket is open even if a photo fails; the thread shows which made it.
    await attachPhotos(token, created, photos).catch(() => undefined);
    router.replace(`${supportBase(hold)}/${created.id}`);
  };

  return (
    <form
      className={styles.page}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <h1 className={styles.title}>Message support</h1>
      {context && (
        <p className={styles.about}>
          <Icon name="info" size={16} />
          {`About ${context.label ?? "this"}`}
        </p>
      )}
      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="support-topic">
            Topic
          </label>
          <select
            id="support-topic"
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportCategory | "")}
            required
          >
            <option value="" disabled>
              What is it about?
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={SUBJECT_MAX}
          placeholder="For example: Payment taken but no order"
          required
        />
        <div className={styles.field}>
          <label className={styles.label} htmlFor="support-text">
            What happened?
          </label>
          <textarea
            id="support-text"
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={TEXT_MAX}
            placeholder="Tell us what you expected and what happened instead. Order numbers and dates help."
            required
          />
          <span className={styles.faint}>{`${text.length}/${TEXT_MAX}`}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Photos (optional)</span>
          <PickedPhotos files={photos} onChange={setPhotos} disabled={sending} />
          <span className={styles.faint}>Screenshots of an error or a photo of the problem. Only you and the Ruxstar team can see them.</span>
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" size="lg" loading={sending} disabled={!canSend}>
          Send
        </Button>
      </div>
    </form>
  );
}

/** A new help ticket: topic, a short subject, what happened, and up to 3 photos. */
export function NewTicket({ hold = false, params }: { hold?: boolean; params: NewTicketParams }) {
  const pass = useHoldPass(hold);
  if (hold && pass === undefined) return <SkeletonRows count={3} />;
  if (hold && !pass) return <PassEnded />;
  return <Form hold={hold} token={pass?.token} params={params} />;
}
