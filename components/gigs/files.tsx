"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Icon } from "@/components/ui";
import { formError } from "@/lib/api/account";
import { keepIdempotencyKey, newIdempotencyKey } from "@/lib/api/client";
import { uploadGigFile, type FileUse, type GigDelivery, type GigFile, type GigOrder, type GigsLimits } from "@/lib/api/gigs";
import { fileSize } from "@/lib/api/orders";
import { downloadHref, filesProblem, momentText } from "@/lib/gigs";
import order from "@/components/shop/order.module.css";
import styles from "./gigs.module.css";

/** A file being sent with an order or a delivery: uploading while `id` is null, until it fails or arrives. */
export interface HeldFile {
  key: string;
  /** Kept across a retry after a lost connection, so the file is stored once. */
  uploadKey: string;
  file: File;
  name: string;
  bytes: number;
  id: string | null;
  failed: boolean;
}

export const filesReady = (files: readonly HeldFile[]) => files.every((f) => f.id);
export const fileIdsOf = (files: readonly HeldFile[]) => files.flatMap((f) => (f.id ? [f.id] : []));

/** Pick files, each sent straight away; pick one that failed to try again, or the cross to drop it. */
export function FilesField({
  use,
  maxMb,
  limits,
  files,
  setFiles,
  label,
}: {
  use: FileUse;
  maxMb: number;
  limits: Pick<GigsLimits, "files" | "extensions">;
  files: HeldFile[];
  setFiles: Dispatch<SetStateAction<HeldFile[]>>;
  label: string;
}) {
  const [problem, setProblem] = useState<string | null>(null);

  const upload = async (held: HeldFile) => {
    const update = (patch: Partial<HeldFile>) => setFiles((prev) => prev.map((f) => (f.key === held.key ? { ...f, ...patch } : f)));
    update({ failed: false });
    try {
      const saved = await uploadGigFile(held.file, use, held.uploadKey);
      update({ id: saved.id, bytes: saved.bytes });
    } catch (err) {
      setProblem(formError(err).message);
      update({ failed: true, uploadKey: keepIdempotencyKey(err) ? held.uploadKey : newIdempotencyKey() });
    }
  };

  const pick = async (picked: File[]) => {
    setProblem(null);
    if (!picked.length) return;
    const wrong = filesProblem(picked, files, maxMb, limits);
    if (wrong) {
      setProblem(wrong);
      return;
    }
    const added = picked.map((file) => ({ key: newIdempotencyKey(), uploadKey: newIdempotencyKey(), file, name: file.name, bytes: file.size, id: null, failed: false }));
    setFiles((prev) => [...prev, ...added]);
    for (const held of added) await upload(held);
  };

  return (
    <section className={order.section}>
      <span className={order.label}>{label}</span>
      {files.map((f) => (
        <div key={f.key} className={order.file}>
          <Icon name={f.failed ? "alert" : "stack"} size={20} />
          <span className={order.fileText}>
            <span className={order.fileName}>{f.name}</span>
            {f.failed ? (
              <button type="button" className={styles.retry} onClick={() => void upload(f)}>
                Not sent · try again
              </button>
            ) : (
              <span className={order.faint}>{f.id ? fileSize(f.bytes) : "Sending…"}</span>
            )}
          </span>
          <button type="button" className={order.remove} aria-label={`Remove ${f.name}`} onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}>
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      {problem && (
        <p className={order.error} role="alert">
          {problem}
        </p>
      )}
      {files.length < limits.files && (
        <label className={order.drop}>
          <Icon name="plus" size={20} />
          <span className={order.fileText}>
            <span className={order.fileName}>{files.length ? "Add more files" : "Add files"}</span>
            <span className={order.faint}>{`Up to ${limits.files} files and ${maxMb} MB in all.`}</span>
          </span>
          <input
            type="file"
            multiple
            accept={limits.extensions.map((e) => `.${e}`).join(",")}
            onChange={(e) => {
              void pick([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </section>
  );
}

/**
 * Downloads an order's file. Links last 10 minutes, so the order is fetched again first and the fresh link is used.
 * `refetch` gives the order as it is now.
 */
export function useFileOpener(refetch: () => Promise<GigOrder>) {
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const open = async (fileId: string) => {
    setOpening(fileId);
    setProblem(null);
    try {
      const now = await refetch();
      const file = [...now.files, ...now.deliveries.flatMap((d) => d.files)].find((f) => f.id === fileId);
      if (file?.url) window.location.assign(downloadHref(file.url));
      else setProblem("This file isn’t kept any more.");
    } catch (err) {
      setProblem(formError(err).message);
    } finally {
      setOpening(null);
    }
  };
  return { opening, problem, open };
}

export function FileList({ files, opening, onOpen }: { files: readonly GigFile[]; opening: string | null; onOpen: (id: string) => void }) {
  return (
    <>
      {files.map((file) => (
        <div key={file.id} className={order.file} data-gone={!file.url || undefined}>
          <Icon name="stack" size={20} />
          <span className={order.fileText}>
            <span className={order.fileName}>{file.name}</span>
            <span className={order.faint}>{file.url ? fileSize(file.bytes) : "Deleted"}</span>
          </span>
          {file.url && (
            <button type="button" className={order.fileDownload} onClick={() => onOpen(file.id)} disabled={opening === file.id} aria-busy={opening === file.id}>
              <Icon name="download" size={16} />
              {opening === file.id ? "Downloading…" : "Download"}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

/** What the customer sent with the order: answers to the gig's questions, a note and files. Null when there's none. */
export function BriefCard({ order: o, opening, onOpen }: { order: GigOrder; opening: string | null; onOpen: (id: string) => void }) {
  if (!o.answers.length && !o.note && !o.files.length) return null;
  return (
    <div className={styles.card}>
      {(o.answers.length > 0 || o.note) && (
        <dl className={styles.qa}>
          {o.answers.map((a) => (
            <div key={a.question}>
              <dt>{a.question}</dt>
              <dd>{a.answer}</dd>
            </div>
          ))}
          {o.note && (
            <div>
              <dt>Note</dt>
              <dd>{o.note}</dd>
            </div>
          )}
        </dl>
      )}
      {o.files.length > 0 && <FileList files={o.files} opening={opening} onOpen={onOpen} />}
    </div>
  );
}

const ANSWER: Record<NonNullable<GigDelivery["answer"]>["kind"], string> = {
  approved: "Approved",
  revision: "Changes asked for",
  problem: "Problem reported",
};

/** One delivery: the freelancer's message, links and files, and how the customer answered it. */
export function DeliveryCard({ delivery, number, opening, onOpen }: { delivery: GigDelivery; number: number; opening: string | null; onOpen: (id: string) => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <strong>{number === 1 ? "Delivery" : `Delivery ${number}`}</strong>
        <span className={order.faint}>{momentText(delivery.at)}</span>
      </div>
      <p className={styles.preLine}>{delivery.message}</p>
      {delivery.links.length > 0 && (
        <ul className={styles.links}>
          {delivery.links.map((l) => (
            <li key={l}>
              <Icon name="share" size={16} />
              <a href={l} target="_blank" rel="noreferrer noopener">
                {l.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
      {delivery.files.length > 0 && <FileList files={delivery.files} opening={opening} onOpen={onOpen} />}
      {delivery.answer && (
        <p className={styles.answer} data-kind={delivery.answer.kind}>
          {[ANSWER[delivery.answer.kind], delivery.answer.note].filter(Boolean).join(": ")}
        </p>
      )}
    </div>
  );
}
