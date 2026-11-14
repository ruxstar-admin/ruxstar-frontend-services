"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, Tag } from "@/components/ui";
import { addTicketPhoto, getSupportPass, type SupportPass, type Ticket, type TicketDetail } from "@/lib/api/support";
import { shrinkPhoto } from "@/lib/photo";
import { CATEGORY_LABEL, PHOTO_SIDE, PHOTOS_MAX, STATUS } from "@/lib/support";
import { ago, exact } from "@/lib/time";
import styles from "./support.module.css";

/**
 * The pass an account on hold reached these pages with. `undefined` while it is read on this side of the page,
 * `null` once it has run out or the page was reloaded (it lives in memory only).
 */
export function useHoldPass(hold: boolean): SupportPass | null | undefined {
  const [pass, setPass] = useState<SupportPass | null | undefined>(undefined);
  useEffect(() => {
    if (!hold) return;
    const held = getSupportPass();
    setPass(held && Date.parse(held.expiresAt) > Date.now() ? held : null);
  }, [hold]);
  return hold ? pass : null;
}

export function TicketRow({ href, ticket }: { href: string; ticket: Ticket }) {
  const status = STATUS[ticket.status];
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>
            {ticket.unread && <i className={styles.unread} role="img" aria-label="New reply" />}
            <span>{ticket.subject}</span>
          </span>
          <span className={styles.faint}>{`${ticket.number} · ${CATEGORY_LABEL[ticket.category]} · ${ago(ticket.lastAt)}`}</span>
        </span>
        <span className={styles.rowEnd}>
          <Tag tone={status.tone}>{status.label}</Tag>
        </span>
      </Link>
    </li>
  );
}

export function MessageBubble({
  text,
  photos,
  at,
  mine,
  byline,
  internal = false,
}: {
  text: string;
  photos: { id: string; url: string }[];
  at: string;
  mine: boolean;
  byline: string;
  internal?: boolean;
}) {
  return (
    <li className={styles.message} data-mine={mine || undefined} data-internal={internal || undefined}>
      <span className={styles.byline}>
        {byline} · <time dateTime={at} title={exact(at)}>{ago(at)}</time>
      </span>
      {text && <p className={styles.messageText}>{text}</p>}
      {photos.length > 0 && (
        <div className={styles.photos}>
          {photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className={styles.photo} aria-label="Open photo">
              <img src={p.url} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

/** Photos picked to go with the next message, shown before they are sent. */
export function PickedPhotos({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  const room = PHOTOS_MAX - files.length;

  return (
    <div className={styles.photos}>
      {previews.map((url, i) => (
        <div key={url} className={styles.photo}>
          <img src={url} alt="" />
          <button
            type="button"
            className={styles.removePhoto}
            aria-label="Remove photo"
            disabled={disabled}
            onClick={() => onChange(files.filter((_, j) => j !== i))}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {room > 0 && (
        <label className={styles.addPhoto}>
          <Icon name="image" size={20} />
          {files.length === 0 ? "Add photos" : "Add more"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).slice(0, room);
              e.target.value = "";
              if (picked.length) onChange([...files, ...picked]);
            }}
          />
        </label>
      )}
    </div>
  );
}

/** Uploads picked photos, one after another, onto the newest message you sent. Returns the ticket as it ends up. */
export async function attachPhotos(pass: string | undefined, ticket: TicketDetail, files: File[]): Promise<TicketDetail> {
  const mine = [...ticket.messages].reverse().find((m) => m.mine);
  if (!mine) return ticket;
  let latest = ticket;
  for (const file of files) latest = await addTicketPhoto(pass, ticket.id, mine.id, await shrinkPhoto(file, PHOTO_SIDE));
  return latest;
}
