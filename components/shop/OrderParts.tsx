import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, Tag } from "@/components/ui";
import { ago, exact } from "@/lib/time";
import {
  fileSize,
  priceLines,
  PROBLEM_LABEL,
  PROBLEM_PHOTOS_MAX,
  progressOf,
  resolutionLine,
  STATUS_TONE,
  type Order,
  type OrderProblem,
  type OrderStatus,
  type PrintFile,
  type Quote,
} from "@/lib/api/orders";
import { money } from "@/lib/api/shops";
import styles from "./order.module.css";

type Line = { label: string; amount: number; negative?: boolean };

/** The itemised price and total, then any lines after it, like the shop's commission. */
export function PriceList({ price, pricing, after = [] }: { price: Pick<Quote, "units" | "unitPrice" | "extrasPerUnit" | "platformFee" | "total">; pricing: "per_unit" | "per_page"; after?: Line[] }) {
  return (
    <dl className={styles.prices}>
      {priceLines(price, pricing).map((l) => (
        <div key={l.label} className={styles.priceRow}>
          <dt>{l.label}</dt>
          <dd>{money(l.amount)}</dd>
        </div>
      ))}
      <div className={`${styles.priceRow} ${styles.total}`}>
        <dt>Total</dt>
        <dd>{money(price.total)}</dd>
      </div>
      {after.map((l) => (
        <div key={l.label} className={styles.priceRow}>
          <dt>{l.label}</dt>
          <dd>{`${l.negative ? "−" : ""}${money(l.amount)}`}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FileItem({ file, onOpen, action }: { file: PrintFile; onOpen?: () => void; action?: ReactNode }) {
  const body = (
    <>
      <Icon name={file.contentType === "application/pdf" ? "book" : "image"} size={20} />
      <span className={styles.fileText}>
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.faint}>{`${file.pages} ${file.pages === 1 ? "page" : "pages"} · ${fileSize(file.bytes)}`}</span>
      </span>
    </>
  );
  if (onOpen) {
    return (
      <button type="button" className={styles.file} onClick={onOpen}>
        {body}
        <Icon name="arrow-right" size={18} />
      </button>
    );
  }
  return (
    <div className={styles.file}>
      {body}
      {action}
    </div>
  );
}

export function Progress({ order }: { order: Pick<Order, "status" | "timeline"> }) {
  return (
    <ol className={styles.progress}>
      {progressOf(order).map((step) => (
        <li key={step.status} data-done={step.at ? true : undefined}>
          <span className={styles.dotMark}>{step.at && <Icon name="check" size={12} />}</span>
          <span className={styles.stepLabel}>{step.label}</span>
          {step.at && (
            <time className={styles.faint} dateTime={step.at} title={exact(step.at)}>
              {ago(step.at)}
            </time>
          )}
        </li>
      ))}
    </ol>
  );
}

/** A reported problem: what went wrong, the photos, and what Ruxstar decided. Photos are added by picking a file while it is open. */
export function ProblemCard({ problem, forShop = false, onAddPhoto, adding }: { problem: OrderProblem; forShop?: boolean; onAddPhoto?: (file: File) => void; adding?: boolean }) {
  const open = problem.status === "open";
  const room = open && problem.photos.length < PROBLEM_PHOTOS_MAX && !!onAddPhoto;
  return (
    <div className={styles.problem}>
      <div className={styles.problemHead}>
        <strong>{PROBLEM_LABEL[problem.kind]}</strong>
        <Tag tone={open ? "warning" : "success"}>{open ? "With Ruxstar" : "Settled"}</Tag>
      </div>
      <time className={styles.faint} dateTime={problem.reportedAt} title={exact(problem.reportedAt)}>
        {`Reported ${ago(problem.reportedAt)}`}
      </time>
      <p>{problem.note}</p>
      {(problem.photos.length > 0 || room) && (
        <div className={styles.photos}>
          {problem.photos.map((photo, i) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className={styles.photo}>
              <img src={photo.url} alt={`Photo ${i + 1}`} />
            </a>
          ))}
          {room && (
            <label className={styles.addPhoto} data-busy={adding ? true : undefined}>
              <Icon name="camera" size={20} />
              <span className={styles.faint}>{adding ? "Adding…" : "Add photo"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={adding}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onAddPhoto(file);
                }}
              />
            </label>
          )}
        </div>
      )}
      <p className={open ? styles.small : undefined}>{resolutionLine(problem, forShop)}</p>
    </div>
  );
}

export function OrderRow({
  href,
  order,
  subtitle,
  amount,
  labels,
}: {
  href: string;
  order: Pick<Order, "orderNo" | "productLabel" | "status" | "createdAt">;
  subtitle: string;
  amount: number;
  labels: Record<OrderStatus, string>;
}) {
  return (
    <li>
      <Link href={href} className={styles.row}>
        <span className={styles.rowIcon}>
          <Icon name="print" size={20} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{`${order.productLabel} · #${order.orderNo}`}</span>
          <span className={styles.faint}>{`${subtitle} · ${ago(order.createdAt)}`}</span>
        </span>
        <span className={styles.rowEnd}>
          <strong>{money(amount)}</strong>
          <Tag tone={STATUS_TONE[order.status]}>{labels[order.status]}</Tag>
        </span>
      </Link>
    </li>
  );
}
